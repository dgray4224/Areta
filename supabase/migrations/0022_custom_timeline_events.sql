-- Lightweight ad-hoc timeline entries for the mobile "At a Glance" tray:
-- title-only items with no natural home in workout_plan_items/
-- meal_plan_items (no exercise/recipe backing them) and deliberately not
-- routed through daily_actions/tasks -- the real task system is deferred
-- to a future phase (see the plan). Covers both the preset "common task"
-- quick-adds (Study, Work, Read a book, ...) and fully custom
-- user-typed titles: same shape, same table, only the title differs.

create table public.custom_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  title text not null,
  scheduled_time time,
  created_at timestamptz not null default now()
);

alter table public.custom_timeline_events enable row level security;

create policy "custom_timeline_events_all_own" on public.custom_timeline_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index custom_timeline_events_user_date_idx
  on public.custom_timeline_events (user_id, date);
