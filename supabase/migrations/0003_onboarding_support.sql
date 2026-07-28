-- Onboarding capture + its derived "Onboarding output" (CLAUDE.md Phase 1).
-- Raw step answers live as JSONB here so the question set can keep evolving
-- without a migration each time; profiles/domains/goals/phases (0001-0002)
-- hold the *derived*, normalized structured state (§7 Layer 1).

create table public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  identity jsonb not null default '{}'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  nutrition jsonb not null default '{}'::jsonb,
  recovery jsonb,
  learning jsonb not null default '{}'::jsonb,
  coaching jsonb not null default '{}'::jsonb,
  completed_steps text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_onboarding_responses_updated_at
  before update on public.onboarding_responses
  for each row execute function public.set_updated_at();

alter table public.onboarding_responses enable row level security;

create policy "onboarding_responses_all_own" on public.onboarding_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


create table public.personalization_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  tone text check (tone in ('direct', 'gentle')),
  planning_style text check (planning_style in ('strict', 'flexible')),
  reminder_preference text,
  explanation_depth text,
  reschedule_missed_tasks boolean,
  never_recommend jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_personalization_profiles_updated_at
  before update on public.personalization_profiles
  for each row execute function public.set_updated_at();

alter table public.personalization_profiles enable row level security;

create policy "personalization_profiles_all_own" on public.personalization_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- Thin stub: only persists onboarding's declared "initial weekly outcomes"
-- so the dashboard has something to render. Full weekly-plan machinery is
-- Phase 3/4.
create table public.weekly_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  week_start date not null,
  outcome_text text not null,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_weekly_outcomes_updated_at
  before update on public.weekly_outcomes
  for each row execute function public.set_updated_at();

alter table public.weekly_outcomes enable row level security;

create policy "weekly_outcomes_all_own" on public.weekly_outcomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index weekly_outcomes_user_id_idx on public.weekly_outcomes (user_id);


-- Thin stub: which fields the (Phase 2) Today screen should offer for daily
-- logging, per user. Not the logs themselves.
create table public.daily_checkin_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_daily_checkin_fields_updated_at
  before update on public.daily_checkin_fields
  for each row execute function public.set_updated_at();

alter table public.daily_checkin_fields enable row level security;

create policy "daily_checkin_fields_all_own" on public.daily_checkin_fields
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
