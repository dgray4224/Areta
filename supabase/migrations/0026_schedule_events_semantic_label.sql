-- Reworks schedule_events (migration 0025) to key rows by a stable
-- semantic label instead of the underlying row's reference_id. Two real
-- problems with reference_id as the key:
--
-- 1. Meal/workout plans get regenerated (new training phase, new week) --
--    generateAndSaveMealPlan/generateAndSaveWorkoutPlan delete and recreate
--    every plan item, so all prior history under the old ids would
--    silently orphan even though "breakfast" is still the same concept.
-- 2. Custom/preset events never recur under the same id -- "Study"
--    scheduled today and "Study" scheduled next week are two different
--    custom_timeline_events rows, so reference_id can never reveal that
--    they're the same recurring habit.
--
-- label is meal_type for meals, the fixed string "workout" for workouts
-- (matches treating a session as one unit elsewhere in this app), and the
-- normalized (trimmed, lowercased) title for custom events. reference_id
-- is kept as an informational pointer to the row that last wrote this
-- day's entry, but is no longer part of the uniqueness constraint --
-- multiple exercises scheduled together as one group now naturally
-- collapse into a single "workout" row per day instead of one per
-- exercise. No real data depends on the old shape (zero production
-- writes), so a clean recreate is simpler than an in-place ALTER.

drop table if exists public.schedule_events;

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meal', 'workout', 'custom')),
  label text not null,
  reference_id uuid,
  date date not null,
  scheduled_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, label, date)
);

create trigger set_schedule_events_updated_at
  before update on public.schedule_events
  for each row execute function public.set_updated_at();

alter table public.schedule_events enable row level security;

create policy "schedule_events_all_own" on public.schedule_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index schedule_events_user_kind_label_idx
  on public.schedule_events (user_id, kind, label, date desc);
