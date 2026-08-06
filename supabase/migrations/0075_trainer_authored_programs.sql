-- Trainer-authored, reusable, multi-week training programs (2026-08-06
-- addition) — a trainer writes their own program once and assigns it to
-- any number of their own clients, instead of every client only being
-- able to run the platform's shared training_programs library (0030).
--
-- Mirrors that exact shape (program -> phases -> sessions -> session
-- exercises) so the same block-periodization model applies: a phase is a
-- run of `length_weeks` identical weeks, and progression happens by
-- advancing to the next phase, not by hand-authoring every single week.
-- Two deliberate differences from the shared library:
--   1. Every table here is trainer-owned (RLS keyed off trainer_id, via
--      the same "walk up the FK chain to trainer_programs.trainer_id"
--      pattern used elsewhere for nested ownership), not
--      platform-shared/select-all.
--   2. A session carries an explicit day_of_week — a trainer specifies
--      real days ("Monday: Squat"), rather than the shared library's
--      materializeWorkoutPlan() inferring day-spacing algorithmically.
--      This also means trainer-program materialization (application
--      code, not this migration) is a direct copy-down, not a
--      substitution/day-spreading pass — what the trainer wrote is
--      exactly what the client's plan shows.
--
-- Materialized weeks still land in the existing workout_plans /
-- workout_plan_items tables (tagged via the new trainer_program_id /
-- trainer_program_phase_id / trainer_program_session_exercise_id
-- columns added below) so the Today screen, mobile app, exercise
-- history, and the already-shipped customize/add-exercise trainer tools
-- all keep working unchanged.

create table public.trainer_programs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_trainer_programs_updated_at
  before update on public.trainer_programs
  for each row execute function public.set_updated_at();

alter table public.trainer_programs enable row level security;

create policy "trainer_programs_owner_all" on public.trainer_programs
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create index trainer_programs_trainer_idx on public.trainer_programs (trainer_id);


create table public.trainer_program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.trainer_programs (id) on delete cascade,
  phase_order smallint not null,
  name text not null,
  focus text,
  length_weeks smallint not null default 4 check (length_weeks > 0),
  is_final boolean not null default false,
  unique (program_id, phase_order)
);

alter table public.trainer_program_phases enable row level security;

create policy "trainer_program_phases_owner_all" on public.trainer_program_phases
  for all using (
    exists (select 1 from public.trainer_programs p where p.id = program_id and p.trainer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trainer_programs p where p.id = program_id and p.trainer_id = auth.uid())
  );

create index trainer_program_phases_program_idx on public.trainer_program_phases (program_id);


create table public.trainer_program_sessions (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.trainer_program_phases (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  name text,
  session_type text,
  unique (phase_id, day_of_week)
);

alter table public.trainer_program_sessions enable row level security;

create policy "trainer_program_sessions_owner_all" on public.trainer_program_sessions
  for all using (
    exists (
      select 1 from public.trainer_program_phases ph
      join public.trainer_programs p on p.id = ph.program_id
      where ph.id = phase_id and p.trainer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainer_program_phases ph
      join public.trainer_programs p on p.id = ph.program_id
      where ph.id = phase_id and p.trainer_id = auth.uid()
    )
  );

create index trainer_program_sessions_phase_idx on public.trainer_program_sessions (phase_id);


create table public.trainer_program_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trainer_program_sessions (id) on delete cascade,
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

alter table public.trainer_program_session_exercises enable row level security;

create policy "trainer_program_session_exercises_owner_all" on public.trainer_program_session_exercises
  for all using (
    exists (
      select 1 from public.trainer_program_sessions s
      join public.trainer_program_phases ph on ph.id = s.phase_id
      join public.trainer_programs p on p.id = ph.program_id
      where s.id = session_id and p.trainer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainer_program_sessions s
      join public.trainer_program_phases ph on ph.id = s.phase_id
      join public.trainer_programs p on p.id = ph.program_id
      where s.id = session_id and p.trainer_id = auth.uid()
    )
  );

create index trainer_program_session_exercises_session_idx on public.trainer_program_session_exercises (session_id);


-- Assignment: which client is currently running which trainer program,
-- and where they are in it. One trainer per client is already enforced
-- (trainer_clients, migration 0066) — this adds "one *active* program
-- assignment per client" on top, at the DB level, same partial-unique-
-- index technique.
create table public.trainer_program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.trainer_programs (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  -- What happens once the client finishes the program's final phase:
  -- loop back to phase 1 (repeat) or keep replaying the final phase's
  -- last week indefinitely (freeze) until the trainer assigns something
  -- new. No third "stop generating" option — the weekly cron always owes
  -- every client a fresh draft; freeze just stops content from changing.
  on_complete text not null default 'repeat' check (on_complete in ('repeat', 'freeze')),
  current_phase_id uuid references public.trainer_program_phases (id),
  phase_week_number smallint not null default 1 check (phase_week_number > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger set_trainer_program_assignments_updated_at
  before update on public.trainer_program_assignments
  for each row execute function public.set_updated_at();

create unique index trainer_program_assignments_one_active_per_client
  on public.trainer_program_assignments (client_id) where status = 'active';

alter table public.trainer_program_assignments enable row level security;

create policy "trainer_program_assignments_trainer_all" on public.trainer_program_assignments
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "trainer_program_assignments_client_select" on public.trainer_program_assignments
  for select using (auth.uid() = client_id);

create index trainer_program_assignments_client_idx on public.trainer_program_assignments (client_id);
create index trainer_program_assignments_program_idx on public.trainer_program_assignments (program_id);


-- A client with an active assignment can read the structure of the
-- program they're actually on (not any other program the trainer has
-- authored/drafted) — mirrors how a client can already see their own
-- assigned trainer's identity, but scoped per-program via the assignment
-- row rather than a blanket trainer relationship.
create policy "trainer_programs_assigned_client_select" on public.trainer_programs
  for select using (
    exists (
      select 1 from public.trainer_program_assignments a
      where a.program_id = id and a.client_id = auth.uid() and a.status = 'active'
    )
  );

create policy "trainer_program_phases_assigned_client_select" on public.trainer_program_phases
  for select using (
    exists (
      select 1 from public.trainer_program_assignments a
      where a.program_id = trainer_program_phases.program_id and a.client_id = auth.uid() and a.status = 'active'
    )
  );

create policy "trainer_program_sessions_assigned_client_select" on public.trainer_program_sessions
  for select using (
    exists (
      select 1 from public.trainer_program_phases ph
      join public.trainer_program_assignments a on a.program_id = ph.program_id
      where ph.id = trainer_program_sessions.phase_id and a.client_id = auth.uid() and a.status = 'active'
    )
  );

create policy "trainer_program_session_exercises_assigned_client_select" on public.trainer_program_session_exercises
  for select using (
    exists (
      select 1 from public.trainer_program_sessions s
      join public.trainer_program_phases ph on ph.id = s.phase_id
      join public.trainer_program_assignments a on a.program_id = ph.program_id
      where s.id = trainer_program_session_exercises.session_id and a.client_id = auth.uid() and a.status = 'active'
    )
  );


-- Traceability from a materialized plan/item back to its trainer-authored
-- source, alongside the existing program_id/program_phase_id (shared
-- library) and program_session_exercise_id columns from migration 0030 —
-- additive, not a replacement; a given plan/item is tagged with exactly
-- one of the two families depending on where it came from.
alter table public.workout_plans
  add column trainer_program_id uuid references public.trainer_programs (id),
  add column trainer_program_phase_id uuid references public.trainer_program_phases (id);

alter table public.workout_plan_items
  add column trainer_program_session_exercise_id uuid references public.trainer_program_session_exercises (id);


-- Trainer-submitted exercises (new-exercise-while-building-a-program):
-- inserted with status 'review' (exercises_admin_write, migration 0060,
-- already lets an admin move it to 'active'/'deprecated' from there —
-- no new admin-side policy needed). created_by lets admin content review
-- and the trainer's own "my submitted exercises" view attribute it;
-- nullable since every pre-existing row and every admin-authored row has
-- no trainer author.
alter table public.exercises add column created_by uuid references auth.users (id);

create policy "exercises_trainer_insert" on public.exercises
  for insert
  with check (
    public.is_trainer(auth.uid()) and status = 'review' and created_by = auth.uid()
  );

create policy "exercises_trainer_select_own" on public.exercises
  for select using (created_by = auth.uid());

create index exercises_created_by_idx on public.exercises (created_by);
