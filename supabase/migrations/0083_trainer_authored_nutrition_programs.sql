-- Trainer-authored, reusable, multi-phase nutrition programs (2026-08-07),
-- the nutrition-side counterpart to trainer_programs (migration 0075).
-- Mirrors that shape (program -> phases -> ... -> assignment) closely,
-- with two deliberate structural differences and two deliberate
-- omissions:
--
-- 1. No "session" grouping level. A workout session groups several
--    exercises under one name ("Upper Body A"); a meal slot is already
--    fully identified by (day_of_week, meal_type), so
--    trainer_meal_program_meals sits directly under phases, one row per
--    recipe per meal slot per day (multiple rows may share a slot, e.g.
--    a main + a side).
-- 2. No baseline serving size lives on the authored program at all.
--    Portions are entirely per-client (2026-08-07, explicit product
--    decision): a trainer manually tailors serving sizes per assigned
--    client rather than the program carrying one fixed portion for
--    everyone, because unlike a workout's sets/reps, a sensible portion
--    genuinely depends on that specific person's calorie/protein
--    targets. The app will *recommend* a starting serving size from the
--    client's own approved targets (deterministic math, no AI — reusing
--    the same spirit as domains/parameters/nutrition-calc.ts), but
--    nothing about that recommendation is stored here or needs its own
--    column: trainer_meal_program_portions.servings is simply "what the
--    trainer decided," identical in shape to meal_plan_items.servings,
--    computed fresh from current targets every time the recommendation
--    is shown rather than frozen at some earlier point.
--
-- Omitted from day one, both learned the hard way on the workout side
-- (migrations 0081/0082) rather than built and then removed here too:
-- no repeat/freeze-on-phase-completion rule (a phase running out just
-- means nothing's scheduled until the trainer acts, same as
-- "phases_complete" on the workout calendar) and no auto-approve toggle
-- (every materialization just writes 'active' directly -- CLAUDE.md rule
-- 10 protects a user's own self-service plan generation, not a trainer
-- acting on a client who already consented by accepting them). Also
-- dropped the workout side's vestigial 'paused' assignment status --
-- grepping the whole app confirms no code path ever sets it there
-- either, so it isn't copied forward here.
--
-- Materialized weeks land in the existing meal_plans / meal_plan_items
-- tables (tagged via new trainer_meal_program_id / _phase_id / _meal_id
-- columns, exactly mirroring workout_plans/workout_plan_items' own
-- trainer_program_* columns) so the existing grocery-list and Sunday-
-- prep cascade off meal-plan approval keeps working completely
-- unchanged for a trainer-authored plan.

create table public.trainer_meal_programs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_trainer_meal_programs_updated_at
  before update on public.trainer_meal_programs
  for each row execute function public.set_updated_at();

alter table public.trainer_meal_programs enable row level security;

create policy "trainer_meal_programs_owner_all" on public.trainer_meal_programs
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create index trainer_meal_programs_trainer_idx on public.trainer_meal_programs (trainer_id);


create table public.trainer_meal_program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.trainer_meal_programs (id) on delete cascade,
  phase_order smallint not null,
  name text not null,
  focus text,
  length_weeks smallint not null default 4 check (length_weeks > 0),
  is_final boolean not null default false,
  unique (program_id, phase_order)
);

alter table public.trainer_meal_program_phases enable row level security;

create policy "trainer_meal_program_phases_owner_all" on public.trainer_meal_program_phases
  for all using (
    exists (select 1 from public.trainer_meal_programs p where p.id = program_id and p.trainer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trainer_meal_programs p where p.id = program_id and p.trainer_id = auth.uid())
  );

create index trainer_meal_program_phases_program_idx on public.trainer_meal_program_phases (program_id);


-- One row per recipe per meal slot per day within a phase. No servings
-- column here -- see the migration-level comment above for why portion
-- size is a per-client concern (trainer_meal_program_portions below),
-- not authored on the program itself.
create table public.trainer_meal_program_meals (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.trainer_meal_program_phases (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_order smallint not null default 0,
  recipe_id uuid not null references public.recipes (id),
  created_at timestamptz not null default now()
);

alter table public.trainer_meal_program_meals enable row level security;

create policy "trainer_meal_program_meals_owner_all" on public.trainer_meal_program_meals
  for all using (
    exists (
      select 1 from public.trainer_meal_program_phases ph
      join public.trainer_meal_programs p on p.id = ph.program_id
      where ph.id = phase_id and p.trainer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainer_meal_program_phases ph
      join public.trainer_meal_programs p on p.id = ph.program_id
      where ph.id = phase_id and p.trainer_id = auth.uid()
    )
  );

create index trainer_meal_program_meals_phase_idx on public.trainer_meal_program_meals (phase_id);


-- Assignment: which client is running which trainer meal program, and
-- when. Independent of trainer_program_assignments (workout side) -- a
-- client can be on both a workout program and a nutrition program at
-- once, each with its own "one active per client" constraint.
create table public.trainer_meal_program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.trainer_meal_programs (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  starts_on date not null default current_date,
  -- Nullable at the database level, same reasoning as
  -- trainer_program_assignments (migration 0078): no sensible default,
  -- "required" is enforced at the application layer instead. Hard
  -- cutoff once end_date passes, same auto-end behavior as the workout
  -- side.
  end_date date,
  goal_outcome text,
  linked_goal_id uuid references public.goals (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger set_trainer_meal_program_assignments_updated_at
  before update on public.trainer_meal_program_assignments
  for each row execute function public.set_updated_at();

create unique index trainer_meal_program_assignments_one_active_per_client
  on public.trainer_meal_program_assignments (client_id) where status = 'active';

alter table public.trainer_meal_program_assignments enable row level security;

create policy "trainer_meal_program_assignments_trainer_all" on public.trainer_meal_program_assignments
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "trainer_meal_program_assignments_client_select" on public.trainer_meal_program_assignments
  for select using (auth.uid() = client_id);

create index trainer_meal_program_assignments_client_idx on public.trainer_meal_program_assignments (client_id);
create index trainer_meal_program_assignments_program_idx on public.trainer_meal_program_assignments (program_id);


-- Per-client portion sizes -- see the migration-level comment above.
-- No row means "not yet tailored for this client"; application code
-- computes a live recommendation from the client's current approved
-- targets in that case rather than reading a stale stored one.
create table public.trainer_meal_program_portions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.trainer_meal_program_assignments (id) on delete cascade,
  program_meal_id uuid not null references public.trainer_meal_program_meals (id) on delete cascade,
  servings numeric not null default 1 check (servings > 0),
  updated_at timestamptz not null default now(),
  unique (assignment_id, program_meal_id)
);

create trigger set_trainer_meal_program_portions_updated_at
  before update on public.trainer_meal_program_portions
  for each row execute function public.set_updated_at();

alter table public.trainer_meal_program_portions enable row level security;

create policy "trainer_meal_program_portions_trainer_all" on public.trainer_meal_program_portions
  for all using (
    exists (
      select 1 from public.trainer_meal_program_assignments a
      where a.id = assignment_id and a.trainer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainer_meal_program_assignments a
      where a.id = assignment_id and a.trainer_id = auth.uid()
    )
  );

create index trainer_meal_program_portions_assignment_idx on public.trainer_meal_program_portions (assignment_id);


-- A client with an active assignment can read the structure of the
-- program they're actually on -- mirrors
-- trainer_programs_assigned_client_select and siblings (migration 0075).
create policy "trainer_meal_programs_assigned_client_select" on public.trainer_meal_programs
  for select using (
    exists (
      select 1 from public.trainer_meal_program_assignments a
      where a.program_id = id and a.client_id = auth.uid() and a.status = 'active'
    )
  );

create policy "trainer_meal_program_phases_assigned_client_select" on public.trainer_meal_program_phases
  for select using (
    exists (
      select 1 from public.trainer_meal_program_assignments a
      where a.program_id = trainer_meal_program_phases.program_id
        and a.client_id = auth.uid() and a.status = 'active'
    )
  );

create policy "trainer_meal_program_meals_assigned_client_select" on public.trainer_meal_program_meals
  for select using (
    exists (
      select 1 from public.trainer_meal_program_phases ph
      join public.trainer_meal_program_assignments a on a.program_id = ph.program_id
      where ph.id = trainer_meal_program_meals.phase_id
        and a.client_id = auth.uid() and a.status = 'active'
    )
  );


-- Traceability from a materialized plan/item back to its trainer-authored
-- source, additive alongside meal_plans/meal_plan_items' existing
-- columns -- exactly mirrors workout_plans.trainer_program_id /
-- workout_plan_items.trainer_program_session_exercise_id (migration
-- 0075).
alter table public.meal_plans
  add column trainer_meal_program_id uuid references public.trainer_meal_programs (id),
  add column trainer_meal_program_phase_id uuid references public.trainer_meal_program_phases (id);

alter table public.meal_plan_items
  add column trainer_meal_program_meal_id uuid references public.trainer_meal_program_meals (id);


-- Trainer-submitted recipes (new-recipe-while-building-a-program),
-- mirroring exercises.created_by / exercises_trainer_insert /
-- exercises_trainer_select_own exactly (migration 0075). Inserted with
-- status 'review' -- recipes_admin_write (migration 0061) already lets
-- an admin move it to 'active'/'deprecated' from there, no new
-- admin-side policy needed. Immediately usable by that trainer's own
-- clients (see recipes_trainer_select_own) without waiting on review,
-- same as custom exercises.
alter table public.recipes add column created_by uuid references auth.users (id);

create policy "recipes_trainer_insert" on public.recipes
  for insert
  with check (
    public.is_trainer(auth.uid()) and status = 'review' and created_by = auth.uid()
  );

create policy "recipes_trainer_select_own" on public.recipes
  for select using (created_by = auth.uid());

create index recipes_created_by_idx on public.recipes (created_by);
