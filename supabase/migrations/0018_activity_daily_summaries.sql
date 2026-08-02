-- Silver-layer daily activity summary: 1 row per user per day, derived from
-- weight_logs/sleep_logs/step_logs/heart_rate_logs/workout_logs. Populated
-- incrementally by domains/activity-summary/service.ts, not a scheduled
-- job -- this repo has no cron/scheduler infrastructure, matching the
-- existing weekly_reviews/weekly_outcomes convention of computing on
-- ordinary write/request paths. See CLAUDE.md §14.

create table public.activity_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  -- IANA tz used to bucket this row into `day` -- profiles.time_zone can
  -- change later; this lets us tell whether an old row was computed under
  -- a since-changed setting. Not retroactively recomputed if it changes.
  timezone text not null default 'UTC',

  workout_count integer not null default 0,
  workout_total_minutes integer not null default 0,
  workout_first_start_at timestamptz,
  workout_last_start_at timestamptz,
  workout_first_start_local_hour smallint check (workout_first_start_local_hour between 0 and 23),

  weight_logged boolean not null default false,
  weight_first_value numeric,
  weight_last_value numeric,
  weight_unit text check (weight_unit in ('lb', 'kg')),
  weight_last_logged_at timestamptz,

  steps_total integer not null default 0,
  steps_most_active_local_hour smallint check (steps_most_active_local_hour between 0 and 23),

  sleep_logged boolean not null default false,
  sleep_total_duration_minutes integer,
  sleep_quality smallint check (sleep_quality between 1 and 5),

  heart_rate_avg_bpm numeric,
  heart_rate_sample_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, day)
);

create trigger set_activity_daily_summaries_updated_at
  before update on public.activity_daily_summaries
  for each row execute function public.set_updated_at();

alter table public.activity_daily_summaries enable row level security;

create policy "activity_daily_summaries_all_own" on public.activity_daily_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index activity_daily_summaries_user_day_idx
  on public.activity_daily_summaries (user_id, day desc);

-- step_logs/heart_rate_logs/workout_logs currently only have a dedup unique
-- constraint -- no index usable for the recompute's per-day range queries.
create index step_logs_user_logged_at_idx on public.step_logs (user_id, logged_at);
create index heart_rate_logs_user_logged_at_idx on public.heart_rate_logs (user_id, logged_at);
create index workout_logs_user_start_date_idx on public.workout_logs (user_id, start_date);
