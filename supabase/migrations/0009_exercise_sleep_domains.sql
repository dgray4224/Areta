-- V1 health-only scope: new Exercise domain + Sleep onboarding goals
-- (separate from Recovery, which stays clinical/injury-focused and hidden
-- from V1's onboarding — see domains/goals/schema.ts V1_DOMAIN_KEYS).

-- Column names must match their OnboardingStepKey literal exactly —
-- saveOnboardingStep(userId, step, data) writes `[step]: data` directly as
-- the column name (see domains/onboarding/store.ts), same as every other
-- onboarding step column.
alter table public.onboarding_responses
  add column exercise jsonb not null default '{}'::jsonb;
alter table public.onboarding_responses
  add column sleep jsonb not null default '{}'::jsonb;

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  archetype text,
  duration_minutes integer check (duration_minutes >= 0),
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.exercise_logs enable row level security;

create policy "exercise_logs_all_own" on public.exercise_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index exercise_logs_user_date_idx on public.exercise_logs (user_id, date desc);
