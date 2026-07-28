-- Phase 4: Weekly Review and Regeneration (CLAUDE.md "Phase 4").

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  -- Deterministic derived metrics (Layer 3) snapshot at review time.
  metrics jsonb not null default '{}'::jsonb,
  -- The user's free-text/structured answers to the 5-8 review questions.
  answers jsonb not null default '{}'::jsonb,
  -- The AI-generated WeeklyOperatingBrief (CLAUDE.md §10), once generated.
  brief jsonb,
  status text not null default 'draft' check (status in ('draft', 'answered', 'generated', 'approved')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;

create policy "weekly_reviews_all_own" on public.weekly_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index weekly_reviews_user_week_idx on public.weekly_reviews (user_id, week_start desc);


-- Recommendation Feedback Loop (CLAUDE.md §8): one row per proposed change
-- in a weekly brief, so acceptance can be tracked and referenced in future
-- reviews. Outcome/rating tracking is a known gap — see README.
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekly_review_id uuid references public.weekly_reviews (id) on delete cascade,
  field text not null,
  previous_value jsonb,
  proposed_value jsonb,
  reason text not null,
  confidence numeric,
  accepted boolean,
  created_at timestamptz not null default now()
);

alter table public.recommendations enable row level security;

create policy "recommendations_all_own" on public.recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index recommendations_weekly_review_idx on public.recommendations (weekly_review_id);


-- Lightweight AI-call observability, not a full audit trail.
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,
  model text not null,
  success boolean not null,
  error text,
  created_at timestamptz not null default now()
);

alter table public.ai_runs enable row level security;

create policy "ai_runs_all_own" on public.ai_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index ai_runs_user_id_idx on public.ai_runs (user_id);
