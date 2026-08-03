-- Expert-informed, multi-program training templates (Exercise tab redesign).
-- Replaces the single-generic-formula workout generator with real,
-- periodized programs authored per archetype, multiple per archetype so a
-- user rotates to a different methodology each time they complete one.
-- Shared platform reference data (CLAUDE.md rule 3), same shape as
-- `exercises` (0010): every authenticated user can read, writes only via
-- migration/service role. Named training_program_phases (not phases) to
-- avoid colliding with the unrelated Identity/Goals `public.phases` (0002).

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  archetype text not null check (archetype in (
    'long_distance_runner', 'powerlifter', 'hybrid_athlete', 'general_fitness',
    'hypertrophy', 'triathlete', 'cyclist', 'olympic_weightlifter', 'functional_fitness'
  )),
  slug text not null unique,
  name text not null,
  description text,
  methodology_note text,
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  sessions_per_week_min smallint not null,
  sessions_per_week_max smallint not null,
  equipment_required text[] not null default '{}',
  is_active boolean not null default true,
  display_order smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.training_programs enable row level security;

create policy "training_programs_select_all" on public.training_programs
  for select using (true);

create index training_programs_archetype_idx on public.training_programs (archetype);


create table public.training_program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  phase_order smallint not null,
  name text not null,
  focus text,
  length_weeks smallint not null default 4,
  intensity_style text,
  is_final boolean not null default false,
  unique (program_id, phase_order)
);

alter table public.training_program_phases enable row level security;

create policy "training_program_phases_select_all" on public.training_program_phases
  for select using (true);

create index training_program_phases_program_idx on public.training_program_phases (program_id);


create table public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.training_program_phases (id) on delete cascade,
  session_index smallint not null,
  name text,
  session_type text,
  unique (phase_id, session_index)
);

alter table public.program_sessions enable row level security;

create policy "program_sessions_select_all" on public.program_sessions
  for select using (true);

create index program_sessions_phase_idx on public.program_sessions (phase_id);


create table public.program_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.program_sessions (id) on delete cascade,
  exercise_order smallint not null default 0,
  exercise_id uuid not null references public.exercises (id),
  sets integer,
  reps_min integer,
  reps_max integer,
  intensity_type text check (intensity_type in ('percent_1rm', 'rpe', 'none')),
  intensity_value text,
  duration_minutes integer,
  cardio_intensity text,
  coaching_notes text,
  created_at timestamptz not null default now()
);

alter table public.program_session_exercises enable row level security;

create policy "program_session_exercises_select_all" on public.program_session_exercises
  for select using (true);

create index program_session_exercises_session_idx on public.program_session_exercises (session_id);


-- Rotation history is not a separate table: workout_plans already keeps one
-- row per (user_id, week_start), never deleted, so a distinct-program_id
-- query against it is sufficient to know which programs a user has done.
alter table public.workout_plans
  add column program_id uuid references public.training_programs (id),
  add column program_phase_id uuid references public.training_program_phases (id),
  add column phase_week_number smallint;

alter table public.workout_plan_items
  add column program_session_exercise_id uuid references public.program_session_exercises (id),
  add column reps_min integer,
  add column reps_max integer,
  add column intensity_type text check (intensity_type in ('percent_1rm', 'rpe', 'none')),
  add column intensity_value text,
  add column cardio_intensity text,
  add column coaching_notes text,
  add column substituted boolean not null default false;

-- Future-proofing for the media phase that follows this one -- unused
-- until then.
alter table public.exercises
  add column image_url text,
  add column video_url text;
