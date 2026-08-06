-- Fixes for concrete gaps /code-review found on the trainer-role branch
-- (2026-08-06), verified independently against the actual code before
-- writing this:
--
-- 1. onboarding_responses had no trainer SELECT policy. generateAndSave-
--    MealPlan/generateAndSaveWorkoutPlan (domains/mealplan/service.ts,
--    domains/workoutplan/service.ts) read this table with the caller's
--    session client and silently default to `{}` on a denied/empty read
--    (no error is surfaced). Two concrete consequences: a trainer-
--    generated meal plan silently ignores the client's allergies/
--    disliked foods (safety-relevant in a nutrition app), and
--    generateAndSaveWorkoutPlan unconditionally returns "coming soon"
--    for every trainer-invoked call regardless of the client's actual
--    onboarding shape -- the shipped trainer workout-plan feature was
--    non-functional. Fixed by granting read access.
--
-- 2. approveClientMealPlan (domains/trainer/service.ts) cascades into
--    generateAndSaveGroceryList/generateAndSavePrepPlan
--    (domains/grocery/service.ts, domains/prep/service.ts), which
--    upsert grocery_lists/prep_plans and delete+insert
--    grocery_items/prep_steps -- none of which had a trainer policy, so
--    the cascade this function's own doc comment promised ("same as
--    when the client approves their own plan") would fail outright with
--    an RLS-denied error. Fixed by granting the write access those two
--    functions actually need. inventory_items gets a trainer read too
--    (used for grocery-list generation; a denied read just means
--    inventory isn't subtracted, not a hard failure, but no reason to
--    leave it degraded).
--
-- 3. is_trainer_of() only checked trainer_clients.status = 'active' and
--    never re-checked profiles.is_trainer -- revoking someone's trainer
--    status (setUserTrainerStatus) left their existing trainer_clients
--    rows active, so every RLS policy keyed on is_trainer_of() kept
--    granting them access to former clients' data indefinitely. Fixed
--    by having is_trainer_of() also require is_trainer(p_trainer_id).
--    (domains/users/service.ts's setUserTrainerStatus is also being
--    updated in the same commit to proactively end those relationships,
--    not just rely on this function silently cutting access off.)
--
-- 4. goals and generated_parameters had row-level trainer INSERT/UPDATE
--    with no column restriction -- unlike profiles (0065) and
--    trainer_invite_codes (0069), a straight column-level GRANT/REVOKE
--    can't fix this here, because the *row owner* (the client
--    themselves) legitimately needs to write every column of their own
--    row, and Postgres column privileges are per-role, not per-policy --
--    they can't distinguish "the owner wrote this" from "a trainer wrote
--    this". A BEFORE UPDATE trigger can make that distinction (it sees
--    auth.uid() and can compare against the row's own user_id), so
--    that's what these two use to hold the app's actual promise
--    (goals: only status/priority; generated_parameters: only
--    approved/approved_at, matching approveAllGeneratedParameters, the
--    only write path a trainer has) at the database layer instead of
--    trusting app code alone. The other four trainer-writable tables
--    (meal_plans, meal_plan_items, workout_plans, workout_plan_items)
--    don't get this treatment in this migration -- their trainer write
--    surface is "generate/approve a plan" which is close to the row
--    owner's own full-row capability already, unlike goals/
--    generated_parameters where the app draws a much narrower line than
--    the row grants; left as a known follow-up, not silently ignored.

create policy "onboarding_responses_trainer_select" on public.onboarding_responses
  for select using (public.is_trainer_of(auth.uid(), user_id));

create policy "inventory_items_trainer_select" on public.inventory_items
  for select using (public.is_trainer_of(auth.uid(), user_id));

create policy "grocery_lists_trainer_select" on public.grocery_lists
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "grocery_lists_trainer_insert" on public.grocery_lists
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "grocery_lists_trainer_update" on public.grocery_lists
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "grocery_items_trainer_select" on public.grocery_items
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "grocery_items_trainer_insert" on public.grocery_items
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "grocery_items_trainer_delete" on public.grocery_items
  for delete using (public.is_trainer_of(auth.uid(), user_id));

create policy "prep_plans_trainer_select" on public.prep_plans
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "prep_plans_trainer_insert" on public.prep_plans
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "prep_plans_trainer_update" on public.prep_plans
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "prep_steps_trainer_select" on public.prep_steps
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "prep_steps_trainer_insert" on public.prep_steps
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "prep_steps_trainer_delete" on public.prep_steps
  for delete using (public.is_trainer_of(auth.uid(), user_id));

create or replace function public.is_trainer_of(p_trainer_id uuid, p_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trainer_clients
    where trainer_id = p_trainer_id and client_id = p_client_id and status = 'active'
  ) and public.is_trainer(p_trainer_id);
$$;

create or replace function public.restrict_trainer_goal_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- auth.uid() is null for service-role/script connections (no JWT
  -- context) -- those are already-trusted server-only contexts by
  -- definition (see platform/supabase/admin.ts's own doc comment), not
  -- subject to this restriction. Only an authenticated *different* user
  -- (a trainer) is restricted to the narrow column set below.
  if auth.uid() is null or auth.uid() = new.user_id then
    return new;
  end if;

  if new.outcome is distinct from old.outcome
     or new.why is distinct from old.why
     or new.target_date is distinct from old.target_date
     or new.starting_state is distinct from old.starting_state
     or new.constraints is distinct from old.constraints
     or new.success_criteria is distinct from old.success_criteria
     or new.confidence is distinct from old.confidence
     or new.known_obstacles is distinct from old.known_obstacles
     or new.domain_id is distinct from old.domain_id
     or new.user_id is distinct from old.user_id
  then
    raise exception 'A trainer may only change a client''s goal status and priority';
  end if;

  return new;
end;
$$;

create trigger goals_restrict_trainer_columns
  before update on public.goals
  for each row execute function public.restrict_trainer_goal_columns();

create or replace function public.restrict_trainer_parameter_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Same service-role exemption as restrict_trainer_goal_columns above --
  -- dev-generate-founder-plan.ts's upsert() on this table would otherwise
  -- break the moment it hits the ON CONFLICT UPDATE branch.
  if auth.uid() is null or auth.uid() = new.user_id then
    return new;
  end if;

  if new.value is distinct from old.value
     or new.domain is distinct from old.domain
     or new.name is distinct from old.name
     or new.unit is distinct from old.unit
     or new.range_min is distinct from old.range_min
     or new.range_max is distinct from old.range_max
     or new.source is distinct from old.source
     or new.rationale is distinct from old.rationale
     or new.confidence is distinct from old.confidence
     or new.user_id is distinct from old.user_id
  then
    raise exception 'A trainer may only approve a client''s generated parameters as calculated, not edit them';
  end if;

  return new;
end;
$$;

create trigger generated_parameters_restrict_trainer_columns
  before update on public.generated_parameters
  for each row execute function public.restrict_trainer_parameter_columns();
