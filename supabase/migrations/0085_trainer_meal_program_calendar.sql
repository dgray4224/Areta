-- Per-date calendar view + overrides for trainer-authored nutrition
-- programs (2026-08-07 follow-up) -- nutrition-side mirror of migration
-- 0076's exact shape for workouts. trainer_meal_program_assignments
-- already has starts_on/end_date (migration 0083), unlike the workout
-- side which needed retrofitting there -- nothing to change on that
-- table.
--
-- trainer_meal_program_date_overrides(_meals) lets a trainer set exactly
-- what a *specific date* looks like, independent of the recurring
-- day-of-week template (e.g. "swap this Tuesday's lunch" or "no program
-- meals this one day, client eats freely"). Checked first during
-- materialization, template used as fallback -- see
-- domains/trainermealprogram/calendar-projection.ts, the single function
-- both the calendar UI and the real weekly generator call, so what the
-- calendar shows is never a lie about what's actually in the client's
-- plan (same guarantee migration 0076's own comment describes for
-- workouts).

create table public.trainer_meal_program_date_overrides (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.trainer_meal_program_assignments (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  override_date date not null,
  is_no_program_day boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, override_date)
);

create trigger set_trainer_meal_program_date_overrides_updated_at
  before update on public.trainer_meal_program_date_overrides
  for each row execute function public.set_updated_at();

alter table public.trainer_meal_program_date_overrides enable row level security;

create policy "trainer_meal_program_date_overrides_trainer_all" on public.trainer_meal_program_date_overrides
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "trainer_meal_program_date_overrides_client_select" on public.trainer_meal_program_date_overrides
  for select using (auth.uid() = client_id);

create index trainer_meal_program_date_overrides_assignment_idx on public.trainer_meal_program_date_overrides (assignment_id);
create index trainer_meal_program_date_overrides_client_date_idx on public.trainer_meal_program_date_overrides (client_id, override_date);


create table public.trainer_meal_program_date_override_meals (
  id uuid primary key default gen_random_uuid(),
  override_id uuid not null references public.trainer_meal_program_date_overrides (id) on delete cascade,
  meal_order smallint not null default 0,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid not null references public.recipes (id),
  -- Explicit, not inferred from portions -- an override meal has no
  -- single day-of-week template row to look up a recommendation against,
  -- so the trainer sets the quantity directly when creating it (defaults
  -- to 1, same default meal_plan_items.servings already uses).
  servings numeric not null default 1
);

alter table public.trainer_meal_program_date_override_meals enable row level security;

create policy "trainer_meal_program_date_override_meals_trainer_all" on public.trainer_meal_program_date_override_meals
  for all using (
    exists (
      select 1 from public.trainer_meal_program_date_overrides o
      where o.id = override_id and o.trainer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainer_meal_program_date_overrides o
      where o.id = override_id and o.trainer_id = auth.uid()
    )
  );

create policy "trainer_meal_program_date_override_meals_client_select" on public.trainer_meal_program_date_override_meals
  for select using (
    exists (
      select 1 from public.trainer_meal_program_date_overrides o
      where o.id = override_id and o.client_id = auth.uid()
    )
  );

create index trainer_meal_program_date_override_meals_override_idx on public.trainer_meal_program_date_override_meals (override_id);
