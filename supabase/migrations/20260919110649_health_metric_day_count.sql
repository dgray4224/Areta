-- How many days of a given kind of health data a person actually has.
--
-- The Coverage card used to answer this on the phone by fetching rows
-- and counting the distinct days among them, capped at 400 rows. That
-- undercounts precisely the areas with the most data, because the cap
-- is on samples and the answer is in days: heart rate records many
-- times a day, so 400 unordered samples spanned about two days out of a
-- real 1,016, and movement showed 23 out of 1,923. The richer the
-- record, the emptier the card claimed it was — the opposite of what a
-- coverage view is for.
--
-- Counted in the user's own timezone, matching how every other day
-- boundary in this product is drawn.
--
-- security invoker, so RLS on health_metrics still governs access; the
-- p_user_id predicate is defence in depth, the same posture as
-- health_monthly_totals.
create or replace function public.health_metric_day_count(p_user_id uuid, p_metric_types text[])
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct (started_at at time zone coalesce(
      (select time_zone from profiles where id = p_user_id), 'UTC'))::date)::int
  from health_metrics
  where user_id = p_user_id
    and metric_type = any(p_metric_types);
$$;

comment on function public.health_metric_day_count(uuid, text[]) is
  'How many distinct local days this user has data on for a set of metric types. Replaces a client-side count over a capped row fetch, which undercounted the densest metrics.';

grant execute on function public.health_metric_day_count(uuid, text[]) to authenticated;
