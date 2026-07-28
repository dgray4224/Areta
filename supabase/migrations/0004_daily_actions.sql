-- Phase 2: Today screen task tracking (CLAUDE.md "Today and Logging").
-- daily_actions holds current state per planned task; action_events is an
-- append-only history of status changes (§7 Layer 2 "Preserve history").

create table public.daily_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  domain_id uuid references public.domains (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null,
  description text,
  is_required boolean not null default true,
  priority smallint,
  status text not null default 'planned' check (
    status in ('planned', 'completed', 'partially_completed', 'skipped', 'deferred', 'not_applicable')
  ),
  skip_reason text,
  source text not null default 'manual' check (source in ('manual', 'ai_generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_daily_actions_updated_at
  before update on public.daily_actions
  for each row execute function public.set_updated_at();

alter table public.daily_actions enable row level security;

create policy "daily_actions_all_own" on public.daily_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index daily_actions_user_date_idx on public.daily_actions (user_id, date);


create table public.action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action_id uuid not null references public.daily_actions (id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.action_events enable row level security;

create policy "action_events_all_own" on public.action_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index action_events_action_id_idx on public.action_events (action_id);
