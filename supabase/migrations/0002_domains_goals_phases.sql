-- System hierarchy (CLAUDE.md §4): Identity -> Vision -> Domains -> Goals ->
-- Phases. `key` on domains stays free text (not an enum) so Phase 3 domains
-- (finance, etc.) slot in without a migration.

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create trigger set_domains_updated_at
  before update on public.domains
  for each row execute function public.set_updated_at();

alter table public.domains enable row level security;

create policy "domains_all_own" on public.domains
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index domains_user_id_idx on public.domains (user_id);


create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain_id uuid references public.domains (id) on delete set null,
  outcome text not null,
  why text,
  target_date date,
  starting_state text,
  constraints text,
  success_criteria text,
  priority smallint,
  confidence smallint check (confidence between 1 and 5),
  known_obstacles text,
  status text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;

create policy "goals_all_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index goals_user_id_idx on public.goals (user_id);
create index goals_domain_id_idx on public.goals (domain_id);


create table public.phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  name text not null,
  -- Mission lives per-phase, not per-profile, so Phase 4 regeneration can
  -- evolve it as goals/phases change (CLAUDE.md §4 hierarchy).
  mission text,
  starts_on date not null default current_date,
  ends_on date,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_phases_updated_at
  before update on public.phases
  for each row execute function public.set_updated_at();

alter table public.phases enable row level security;

create policy "phases_all_own" on public.phases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index phases_user_id_idx on public.phases (user_id);
create index phases_goal_id_idx on public.phases (goal_id);
