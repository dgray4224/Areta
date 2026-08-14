-- Insight Engine v2 (2026-08-14): individually addressable insight objects,
-- the substrate for the insights feed, share cards, and (later) insight
-- pushes. Rows are produced ONLY by the deterministic detector battery in
-- domains/insights/ (via the generate-insights cron) -- never by an LLM and
-- never client-side, so `facts` is always ground truth computed from the
-- user's own data.
--
-- dedupe_key makes the daily cron idempotent AND implements per-type
-- resurfacing cooldowns: pattern detectors bucket their key by calendar
-- month (e.g. 'weekday_pattern:tue:2026-08'), so the same finding can't
-- re-fire within a month; records/streak-milestones encode the specific
-- achievement (e.g. 'personal_record:steps_day:2026-08-14') and are
-- naturally one-shot.
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  grain text not null check (grain in ('day', 'week', 'lifetime')),
  period_start date,
  period_end date,
  facts jsonb not null,
  headline text not null,
  score numeric not null default 0,
  dedupe_key text not null,
  status text not null default 'new' check (status in ('new', 'seen', 'dismissed')),
  seen_at timestamptz,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create trigger set_insights_updated_at
  before update on public.insights
  for each row execute function public.set_updated_at();

alter table public.insights enable row level security;

create policy "insights_all_own" on public.insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The feed reads "this user's insights, newest first, often filtered to
-- status='new'" -- one composite index covers both shapes.
create index insights_user_status_created_idx
  on public.insights (user_id, status, created_at desc);
