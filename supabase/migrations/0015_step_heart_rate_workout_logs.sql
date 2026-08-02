-- Fills in the remaining tables from CLAUDE.md §14 Apple Health Roadmap's
-- "Later" list (steps, heart rate, workouts) — weight/sleep already had
-- homes via 0005_logging_tables.sql + 0013_health_import_provenance.sql,
-- these three didn't exist until the HealthKit companion app started
-- sending them to /api/health-sync. Same provenance shape as weight_logs/
-- sleep_logs (source, device, imported_at, user_override, dedup_key) —
-- see 0013 for why. Import-only for v1, no manual-entry path yet, so
-- these columns aren't nullable-for-manual-entry the way weight/sleep's are.

create table public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null,
  count integer not null check (count >= 0),
  source text not null,
  device text,
  imported_at timestamptz,
  user_override boolean not null default false,
  dedup_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.step_logs enable row level security;

create policy step_logs_all_own on public.step_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.heart_rate_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null,
  bpm integer not null check (bpm > 0),
  source text not null,
  device text,
  imported_at timestamptz,
  user_override boolean not null default false,
  dedup_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.heart_rate_logs enable row level security;

create policy heart_rate_logs_all_own on public.heart_rate_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Distinct from exercise_logs (manual/planned exercise logging) and
-- workoutplan's tables (the app's own workout planning domain) — this is
-- raw imported HealthKit workout sessions.
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date timestamptz not null,
  end_date timestamptz not null,
  activity_type text not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  total_energy_burned_kcal numeric,
  total_distance_meters numeric,
  source text not null,
  device text,
  imported_at timestamptz,
  user_override boolean not null default false,
  dedup_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.workout_logs enable row level security;

create policy workout_logs_all_own on public.workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
