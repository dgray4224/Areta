-- Per-date calendar view + overrides for trainer-authored programs
-- (2026-08-06 follow-up). Two changes:
--
-- 1. trainer_program_assignments.starts_on -- when a program run actually
--    begins on the calendar. Previously assignment always implicitly
--    started "this week"; the calendar UI needs a real anchor date to
--    project phase/week onto actual dates, including future-dated starts.
--
-- 2. trainer_program_date_overrides(_exercises) -- lets a trainer set
--    exactly what a *specific date* looks like, independent of the
--    recurring day-of-week template (e.g. "move this Tuesday's leg day
--    to next Thursday" or "give this one date different exercises").
--    Checked first during materialization, template used as fallback --
--    see domains/trainerprogram/calendar-projection.ts, which is the
--    single function both the calendar UI and the real weekly generator
--    call, so what the calendar shows is never a lie about what's
--    actually in the client's plan.
--
-- current_phase_id/phase_week_number are dropped from
-- trainer_program_assignments: they were a stateful "pointer" advanced
-- one step per generation call, which the projection function replaces
-- with a pure computation from starts_on + phase lengths. No live
-- assignment data exists yet (this whole feature shipped earlier the
-- same day, not yet merged to master), so there's nothing to migrate.

alter table public.trainer_program_assignments
  add column starts_on date not null default current_date,
  drop column current_phase_id,
  drop column phase_week_number;

create table public.trainer_program_date_overrides (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.trainer_program_assignments (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  override_date date not null,
  is_rest_day boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, override_date)
);

create trigger set_trainer_program_date_overrides_updated_at
  before update on public.trainer_program_date_overrides
  for each row execute function public.set_updated_at();

alter table public.trainer_program_date_overrides enable row level security;

create policy "trainer_program_date_overrides_trainer_all" on public.trainer_program_date_overrides
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "trainer_program_date_overrides_client_select" on public.trainer_program_date_overrides
  for select using (auth.uid() = client_id);

create index trainer_program_date_overrides_assignment_idx on public.trainer_program_date_overrides (assignment_id);
create index trainer_program_date_overrides_client_date_idx on public.trainer_program_date_overrides (client_id, override_date);


create table public.trainer_program_date_override_exercises (
  id uuid primary key default gen_random_uuid(),
  override_id uuid not null references public.trainer_program_date_overrides (id) on delete cascade,
  exercise_order smallint not null default 0,
  exercise_id uuid not null references public.exercises (id),
  sets integer,
  reps_min integer,
  reps_max integer,
  intensity_type text check (intensity_type in ('percent_1rm', 'rpe', 'none')),
  intensity_value text,
  duration_minutes integer,
  cardio_intensity text,
  coaching_notes text
);

alter table public.trainer_program_date_override_exercises enable row level security;

create policy "trainer_program_date_override_exercises_trainer_all" on public.trainer_program_date_override_exercises
  for all using (
    exists (
      select 1 from public.trainer_program_date_overrides o
      where o.id = override_id and o.trainer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainer_program_date_overrides o
      where o.id = override_id and o.trainer_id = auth.uid()
    )
  );

create policy "trainer_program_date_override_exercises_client_select" on public.trainer_program_date_override_exercises
  for select using (
    exists (
      select 1 from public.trainer_program_date_overrides o
      where o.id = override_id and o.client_id = auth.uid()
    )
  );

create index trainer_program_date_override_exercises_override_idx on public.trainer_program_date_override_exercises (override_id);
