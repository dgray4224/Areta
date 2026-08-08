-- Fixes a real bug in migration 0075's "trainer_programs_assigned_client_select"
-- policy, found while testing the mobile Plan tab's Program/Phase overview
-- against a real trainer-coached test account (created via
-- scripts/create-trainer-test-fixture.ts).
--
-- The original policy's USING clause read:
--   exists (select 1 from trainer_program_assignments a
--           where a.program_id = id and a.client_id = auth.uid() and a.status = 'active')
--
-- The bare `id` inside the EXISTS subquery resolves to the *innermost*
-- scope first -- trainer_program_assignments (aliased `a`) has its own
-- `id` column, so Postgres silently bound it to `a.id` instead of the
-- intended outer `trainer_programs.id`. The policy compiled to
-- `a.program_id = a.id` (confirmed via pg_policies), which is never
-- true for a real row, so this policy has granted a coached client zero
-- rows since it was introduced -- `trainer_programs_owner_all` (the
-- trainer's own access) masked this in every trainer-side test, since
-- the trainer session always satisfied that policy independently.
--
-- The sibling policy on trainer_program_phases got this right by fully
-- qualifying the column (`a.program_id = trainer_program_phases.program_id`)
-- -- same fix applied here.
drop policy if exists "trainer_programs_assigned_client_select" on public.trainer_programs;

create policy "trainer_programs_assigned_client_select" on public.trainer_programs
  for select using (
    exists (
      select 1 from public.trainer_program_assignments a
      where a.program_id = trainer_programs.id and a.client_id = auth.uid() and a.status = 'active'
    )
  );

-- Same exact mistake, copy-pasted into the nutrition-side mirror
-- (migration 0083's own comment says it mirrors 0075) --
-- "trainer_meal_programs_assigned_client_select" compiled to
-- `a.program_id = a.id` for the identical reason. Its sibling policies
-- (trainer_meal_program_phases_assigned_client_select,
-- trainer_meal_program_meals_assigned_client_select) already qualify
-- correctly and don't need this fix.
drop policy if exists "trainer_meal_programs_assigned_client_select" on public.trainer_meal_programs;

create policy "trainer_meal_programs_assigned_client_select" on public.trainer_meal_programs
  for select using (
    exists (
      select 1 from public.trainer_meal_program_assignments a
      where a.program_id = trainer_meal_programs.id and a.client_id = auth.uid() and a.status = 'active'
    )
  );
