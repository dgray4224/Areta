-- Phase 0 of the goal-first personalized training system (see the
-- approved plan for full context). Additive only: no existing table is
-- dropped or altered destructively here. training_programs/rotation.ts
-- and friends keep working unchanged until the recommendation engine
-- (Phase 4) is wired in and confirmed to have zero remaining callers.

-- ============================================================
-- Experts: person AND institution rows share one table so
-- expert_claims.expert_id can stay non-null everywhere (NSCA/ACSM/
-- PubMed etc. cite claims too, but aren't people).
-- ============================================================
create table public.experts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  entity_type text not null check (entity_type in ('person', 'institution')),
  roles text[] not null default '{}',
  specialties text[] not null default '{}',
  credentials jsonb not null default '[]',
  affiliations jsonb not null default '[]',
  research_profiles jsonb not null default '[]',
  coaching_evidence jsonb not null default '[]',
  official_channels jsonb not null default '[]',
  evidence_score numeric,
  practice_score numeric,
  transparency_score numeric,
  reputation_score numeric,
  reach_score numeric,
  specialty_scores jsonb not null default '{}',
  status text not null default 'candidate' check (status in ('candidate', 'approved', 'inactive', 'excluded')),
  inclusion_reason text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.experts enable row level security;
create policy "experts_select_all" on public.experts for select using (true);

-- ============================================================
-- Sources: folds program_sources + the old CREDIBLE_SOURCE_ALLOWLIST
-- into one table, every row citing a single expert entity.
-- ============================================================
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  title text not null,
  organization text not null,
  source_type text not null check (source_type in (
    'peer_reviewed', 'official_expert_content', 'long_form_official_video',
    'official_short_form', 'reputable_interview', 'third_party_summary',
    'social_post', 'certifying_body', 'governing_body'
  )),
  expert_id uuid references public.experts (id),
  published_at date,
  accessed_at date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sources enable row level security;
create policy "sources_select_all" on public.sources for select using (true);
create index sources_expert_idx on public.sources (expert_id);

-- ============================================================
-- Expert claims: atomic, source-cited, versioned via a self-
-- referencing supersedes chain (same pattern as this session's
-- program_session_exercises.primary_exercise_id, applied to claims).
-- ============================================================
create table public.expert_claims (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.experts (id),
  claim_type text not null check (claim_type in (
    'explicit_recommendation', 'programming_rule', 'technique_cue',
    'progression_rule', 'regression', 'caution', 'demonstration_only', 'inference'
  )),
  topic text not null,
  exercise_id uuid references public.exercises (id),
  movement_pattern text,
  applicable_goals text[] not null default '{}',
  applicable_levels text[] not null default '{}',
  required_equipment text[] not null default '{}',
  excluded_conditions text[] not null default '{}',
  normalized_claim text not null,
  short_rationale text not null,
  source_id uuid not null references public.sources (id),
  timestamp_seconds integer,
  page_number integer,
  verbatim_excerpt text,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  valid_from date not null default current_date,
  valid_until date,
  superseded_by uuid references public.expert_claims (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_claims enable row level security;
create policy "expert_claims_select_all" on public.expert_claims for select using (true);
create index expert_claims_expert_idx on public.expert_claims (expert_id);
create index expert_claims_source_idx on public.expert_claims (source_id);
create index expert_claims_review_status_idx on public.expert_claims (review_status);

-- ============================================================
-- Program templates: goal-first structure, replacing
-- training_programs/training_program_phases/program_sessions/
-- program_session_exercises. The leaf table (template_slots) names an
-- ABSTRACT slot, not a concrete exercise -- exercises get chosen at
-- weekly-generation time by the recommendation engine (Phase 4).
-- ============================================================
create table public.program_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  goal text not null check (goal in (
    'lose_fat', 'build_muscle', 'get_stronger', 'improve_endurance',
    'improve_general_fitness', 'move_and_feel_better', 'train_for_event'
  )),
  experience_tier text not null check (experience_tier in ('beginner', 'intermediate', 'advanced')),
  days_per_week_min integer not null,
  days_per_week_max integer not null,
  session_duration_band text not null check (session_duration_band in ('15_20', '30', '45', '60_plus')),
  equipment_context text not null check (equipment_context in (
    'home_no_equipment', 'home_basic_equipment', 'full_gym', 'outdoors', 'combination'
  )),
  limitation_compatible_tags text[] not null default '{}',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.program_templates enable row level security;
create policy "program_templates_select_all" on public.program_templates for select using (true);

create table public.template_phases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.program_templates (id) on delete cascade,
  phase_order integer not null,
  name text not null,
  focus text,
  length_weeks integer not null,
  intensity_style text,
  is_final boolean not null default false
);

alter table public.template_phases enable row level security;
create policy "template_phases_select_all" on public.template_phases for select using (true);
create index template_phases_template_idx on public.template_phases (template_id);

create table public.template_sessions (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.template_phases (id) on delete cascade,
  session_index integer not null,
  name text not null,
  session_type text
);

alter table public.template_sessions enable row level security;
create policy "template_sessions_select_all" on public.template_sessions for select using (true);
create index template_sessions_phase_idx on public.template_sessions (phase_id);

create table public.template_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.template_sessions (id) on delete cascade,
  slot_order integer not null,
  slot_label text not null,
  movement_pattern text not null,
  modality text not null check (modality in ('resistance', 'aerobic', 'mobility', 'power')),
  is_optional boolean not null default false,
  sets_min integer,
  sets_max integer,
  reps_min integer,
  reps_max integer,
  effort_target text,
  rest_seconds integer,
  duration_minutes_min integer,
  duration_minutes_max integer,
  coaching_notes text
);

alter table public.template_slots enable row level security;
create policy "template_slots_select_all" on public.template_slots for select using (true);
create index template_slots_session_idx on public.template_slots (session_id);

-- ============================================================
-- Swap-alternatives, re-anchored to the materialization layer.
-- Slots are now filled dynamically per user per week, so there's no
-- static authored row to hang a self-FK off of (unlike the old
-- program_session_exercises.primary_exercise_id). workout_plan_items
-- gains a link to the abstract slot it was generated from plus
-- honest-attribution provenance; the top-2 runner-up candidates from
-- that same generation pass are persisted as this item's alternates.
-- ============================================================
alter table public.workout_plan_items
  add column template_slot_id uuid references public.template_slots (id),
  add column provenance jsonb;

create table public.workout_plan_item_alternatives (
  id uuid primary key default gen_random_uuid(),
  workout_plan_item_id uuid not null references public.workout_plan_items (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  rank integer not null check (rank in (1, 2)),
  score numeric,
  sets integer,
  reps_min integer,
  reps_max integer,
  intensity_type text,
  intensity_value text,
  duration_minutes integer,
  cardio_intensity text,
  coaching_notes text,
  provenance jsonb,
  created_at timestamptz not null default now()
);

alter table public.workout_plan_item_alternatives enable row level security;
create policy "workout_plan_item_alternatives_select_own" on public.workout_plan_item_alternatives
  for select using (
    exists (
      select 1 from public.workout_plan_items wpi
      where wpi.id = workout_plan_item_alternatives.workout_plan_item_id
        and wpi.user_id = auth.uid()
    )
  );
create index workout_plan_item_alternatives_item_idx on public.workout_plan_item_alternatives (workout_plan_item_id);

-- ============================================================
-- Exercise library enrichment (additive columns, existing rows keep
-- working; canonical_name backfilled from name so nothing is null).
-- ============================================================
alter table public.exercises
  add column canonical_name text,
  add column aliases text[] not null default '{}',
  add column movement_patterns text[] not null default '{}',
  add column secondary_muscle_groups text[] not null default '{}',
  add column modality text check (modality in ('resistance', 'aerobic', 'mobility', 'power')),
  add column unilateral boolean not null default false,
  add column compound boolean not null default false,
  add column setup_requirements text[] not null default '{}',
  add column limitation_tags text[] not null default '{}',
  add column contraindication_notes text,
  add column status text not null default 'active' check (status in ('active', 'review', 'deprecated'));

update public.exercises set canonical_name = name where canonical_name is null;
alter table public.exercises alter column canonical_name set not null;

update public.exercises set movement_patterns = array[movement_pattern] where movement_pattern is not null and movement_patterns = '{}';

create table public.exercise_progressions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  related_exercise_id uuid not null references public.exercises (id) on delete cascade,
  relation text not null check (relation in ('progression', 'regression')),
  constraint exercise_progressions_no_self_reference check (exercise_id <> related_exercise_id)
);

alter table public.exercise_progressions enable row level security;
create policy "exercise_progressions_select_all" on public.exercise_progressions for select using (true);
create index exercise_progressions_exercise_idx on public.exercise_progressions (exercise_id);

-- ============================================================
-- Limitation rules: explicit enforcement table so a limitation tag's
-- effect (exclude/substitute/manual_review) is reviewable data, not
-- inferred ad hoc at recommendation time. action='exclude' rows are a
-- HARD FILTER applied before scoring ever runs -- never a scoring
-- penalty (see the recommendation engine, Phase 4).
-- ============================================================
create table public.limitation_rules (
  id uuid primary key default gen_random_uuid(),
  limitation_tag text not null,
  action text not null check (action in ('exclude', 'substitute', 'manual_review')),
  movement_pattern text,
  exercise_id uuid references public.exercises (id),
  substitute_movement_pattern text,
  rationale text not null,
  source_id uuid references public.sources (id),
  status text not null default 'unreviewed' check (status in ('unreviewed', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint limitation_rules_not_both_targets check (
    not (movement_pattern is not null and exercise_id is not null)
  )
);

alter table public.limitation_rules enable row level security;
create policy "limitation_rules_select_all" on public.limitation_rules for select using (true);
create index limitation_rules_tag_idx on public.limitation_rules (limitation_tag);

-- ============================================================
-- Weekly adaptation: post-week feedback the recommendation engine
-- (Phase 4/5) uses to adjust volume/intensity/progression -- never to
-- auto-progress a user who missed sessions, reported significant pain,
-- or had poor recovery.
-- ============================================================
create table public.weekly_adaptation_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_plan_id uuid not null references public.workout_plans (id) on delete cascade,
  week_start date not null,
  planned_sessions_completed integer,
  perceived_difficulty text check (perceived_difficulty in ('too_easy', 'just_right', 'too_hard')),
  pain_or_discomfort text check (pain_or_discomfort in ('none', 'mild', 'significant')),
  pain_location text,
  recovery_quality text check (recovery_quality in ('poor', 'fair', 'good')),
  liked_exercise_ids uuid[] not null default '{}',
  disliked_exercise_ids uuid[] not null default '{}',
  next_week_preference text check (next_week_preference in ('easier', 'similar', 'harder')),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.weekly_adaptation_responses enable row level security;
create policy "weekly_adaptation_responses_own" on public.weekly_adaptation_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index weekly_adaptation_responses_user_idx on public.weekly_adaptation_responses (user_id, week_start);

-- ============================================================
-- Admin authorization: the first admin-vs-everyone split in this
-- schema (every other table uses per-row user_id ownership RLS).
-- ============================================================
alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create policy "experts_admin_write" on public.experts
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "sources_admin_write" on public.sources
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "expert_claims_admin_write" on public.expert_claims
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "limitation_rules_admin_write" on public.limitation_rules
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
