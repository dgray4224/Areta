-- Append-only log of every time the user assigns a real clock time to a
-- meal, workout group, or custom timeline item on the mobile "At a Glance"
-- schedule. Distinct from the mutable scheduled_time columns on
-- workout_plan_items/meal_plan_items/custom_timeline_events, which only
-- ever hold the CURRENT value -- this table preserves history so a future
-- pass can learn typical timing per user (e.g. "usually eats breakfast
-- around 7:30am") and suggest a starting time instead of guessing. No
-- suggestion/analysis logic reads this yet; this migration only starts
-- collecting the raw signal. reference_id points at the underlying row
-- (workout_plan_items.id / meal_plan_items.id / custom_timeline_events.id)
-- rather than denormalizing a label, so future analysis can join back for
-- meal_type/exercise/title as needed.

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meal', 'workout', 'custom')),
  reference_id uuid not null,
  date date not null,
  scheduled_time time not null,
  created_at timestamptz not null default now()
);

alter table public.schedule_events enable row level security;

create policy "schedule_events_all_own" on public.schedule_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index schedule_events_user_kind_idx on public.schedule_events (user_id, kind, reference_id);
