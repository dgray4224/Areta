-- One weekly operator report, computed in one round trip.
--
-- Exists because the weekly brief silently generated nothing from
-- 2026-08-23 to 2026-09-19 and nobody found out. Alerting now covers
-- "it broke"; this covers the quieter question, "is any of it actually
-- being used", which no dashboard in this product answers.
--
-- SQL rather than a dozen PostgREST count queries: the interesting
-- numbers are adherence ratios that need a join and a date computed from
-- week_start + day_of_week, which PostgREST cannot express. Same
-- reasoning as health_metrics_monthly_rollup (2026-08-26).
--
-- Aggregates across every user, so it is deliberately NOT callable by
-- anon or authenticated. Service role only; the cron route is the caller.
create or replace function public.weekly_usage_report(p_since timestamptz, p_until timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
win as (
  select p_since as since, p_until as until,
         p_since::date as since_d, p_until::date as until_d,
         p_since - (p_until - p_since) as prior_since
),
-- A planned item's real calendar date, so adherence compares what was
-- planned FOR the window against what was ticked in it.
meal_items as (
  select mpi.user_id, mpi.completed_at, (mp.week_start + mpi.day_of_week) as item_date
  from meal_plan_items mpi
  join meal_plans mp on mp.id = mpi.meal_plan_id
  where mp.status = 'active'
),
workout_items as (
  select wpi.user_id, wpi.completed_at, (wp.week_start + wpi.day_of_week) as item_date
  from workout_plan_items wpi
  join workout_plans wp on wp.id = wpi.workout_plan_id
  where wp.status = 'active'
),
active_now as (
  select distinct user_id from (
    select user_id from meal_plan_items, win where completed_at >= since and completed_at < until
    union all
    select user_id from workout_plan_items, win where completed_at >= since and completed_at < until
    union all
    select user_id from nutrition_logs, win where created_at >= since and created_at < until
    union all
    select user_id from health_metrics, win where created_at >= since and created_at < until
  ) x where user_id is not null
),
active_prior as (
  select distinct user_id from (
    select user_id from meal_plan_items, win where completed_at >= prior_since and completed_at < since
    union all
    select user_id from workout_plan_items, win where completed_at >= prior_since and completed_at < since
    union all
    select user_id from nutrition_logs, win where created_at >= prior_since and created_at < since
    union all
    select user_id from health_metrics, win where created_at >= prior_since and created_at < since
  ) x where user_id is not null
)
select jsonb_build_object(
  'window', jsonb_build_object('since', p_since, 'until', p_until),
  'users', (
    select jsonb_build_object(
      'total', count(*),
      'onboarded', count(*) filter (where onboarding_completed_at is not null),
      'stalled_in_onboarding', count(*) filter (where onboarding_completed_at is null),
      'new_this_week', count(*) filter (where created_at >= (select since from win)),
      'onboarded_this_week', count(*) filter (where onboarding_completed_at >= (select since from win))
    ) from profiles
  ),
  'engagement', jsonb_build_object(
    'active_this_week', (select count(*) from active_now),
    'active_prior_week', (select count(*) from active_prior),
    'retained', (select count(*) from active_now a where exists (select 1 from active_prior p where p.user_id = a.user_id))
  ),
  'loop', jsonb_build_object(
    'briefs_generated', (select count(*) from weekly_reviews, win where brief is not null and created_at >= since and created_at < until),
    'briefs_approved', (select count(*) from weekly_reviews, win where approved_at >= since and approved_at < until),
    'meals_planned', (select count(*) from meal_items, win where item_date >= since_d and item_date <= until_d),
    'meals_ticked', (select count(*) from meal_items, win where item_date >= since_d and item_date <= until_d and completed_at is not null),
    'workouts_planned', (select count(*) from workout_items, win where item_date >= since_d and item_date <= until_d),
    'workouts_completed', (select count(*) from workout_items, win where item_date >= since_d and item_date <= until_d and completed_at is not null),
    'meal_swaps', (select count(*) from meal_pick_history, win where picked_at >= since and picked_at < until),
    -- Off-plan only: rows the planned-meal checkbox wrote are the plan,
    -- not a person choosing to log something.
    'offplan_logs', (
      select count(*) from nutrition_logs nl, win
      where nl.date >= since_d and nl.date <= until_d
        and not exists (select 1 from meal_plan_items m where m.nutrition_log_id = nl.id)
    ),
    'quick_estimates', (
      select count(*) from nutrition_logs nl, win
      where nl.date >= since_d and nl.date <= until_d
        and nl.notes = 'Rough estimate from your daily targets'
    )
  ),
  'data_in', jsonb_build_object(
    'users_syncing', (select count(distinct user_id) from health_metrics, win where created_at >= since and created_at < until),
    'health_rows', (select count(*) from health_metrics, win where created_at >= since and created_at < until),
    'push_tokens', (select count(*) from device_push_tokens)
  ),
  'system', jsonb_build_object(
    'ai_runs', (select count(*) from ai_runs, win where created_at >= since and created_at < until),
    'ai_failures', (select count(*) from ai_runs, win where created_at >= since and created_at < until and not success),
    'insights_created', (select count(*) from insights, win where created_at >= since and created_at < until),
    -- Freshness proxies: only the brief records its own runs, so the
    -- other jobs are judged by whether their output is still arriving.
    'last_brief_success', (select max(created_at) from ai_runs where success and purpose = 'weekly_brief'),
    'last_insight_created', (select max(created_at) from insights),
    'last_workout_plan_created', (select max(created_at) from workout_plans),
    'last_meal_plan_created', (select max(created_at) from meal_plans)
  )
);
$$;

comment on function public.weekly_usage_report(timestamptz, timestamptz) is
  'Operator report: reach, engagement, core-loop adherence and system freshness for a time window. Service role only.';

revoke all on function public.weekly_usage_report(timestamptz, timestamptz) from public;
revoke all on function public.weekly_usage_report(timestamptz, timestamptz) from anon;
revoke all on function public.weekly_usage_report(timestamptz, timestamptz) from authenticated;
grant execute on function public.weekly_usage_report(timestamptz, timestamptz) to service_role;
