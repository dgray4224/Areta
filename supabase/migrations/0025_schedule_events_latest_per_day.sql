-- Reworks schedule_events (migration 0024) from append-every-change to one
-- row per (user, kind, reference_id, date), upserted on each reschedule.
-- Append-only history turned out to be the wrong shape for this: a user
-- nudging a block 2-3 times while fine-tuning its position would log 2-3
-- rows for what's really one decision, adding noise to any future
-- "typical time" analysis without adding signal -- only the settled time
-- per day matters for that. No real data depends on the old shape yet
-- (this table has had zero production writes), so a clean recreate is
-- simpler than an in-place ALTER.

drop table if exists public.schedule_events;

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meal', 'workout', 'custom')),
  reference_id uuid not null,
  date date not null,
  scheduled_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, reference_id, date)
);

create trigger set_schedule_events_updated_at
  before update on public.schedule_events
  for each row execute function public.set_updated_at();

alter table public.schedule_events enable row level security;

create policy "schedule_events_all_own" on public.schedule_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index schedule_events_user_kind_idx on public.schedule_events (user_id, kind, reference_id);
