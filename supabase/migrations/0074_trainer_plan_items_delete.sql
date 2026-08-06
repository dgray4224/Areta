-- Found via manual browser testing (2026-08-06), not a code-review pass:
-- generateAndSaveWorkoutPlan/generateAndSaveMealPlan both delete a
-- plan's existing items before inserting a fresh batch (so regenerating
-- replaces, not appends). Migration 0066 granted trainers select/
-- insert/update on workout_plan_items/meal_plan_items but never delete,
-- so when a trainer regenerates a client's plan for a week that already
-- has one, the DELETE silently matches zero authorized rows (no error --
-- RLS just filters it to nothing) and the subsequent INSERT stacks a
-- fresh batch on top of the untouched old one. Confirmed live: 58 rows
-- in a single workout_plan_items regeneration that should have produced
-- ~29, every exercise duplicated exactly once.
--
-- Scoped to just these two item tables, not their parent plan tables
-- (workout_plans/meal_plans never needed trainer delete and still
-- don't) -- clearing old items is an inherent, necessary part of the
-- same "regenerate" action a trainer is already authorized to perform,
-- not a new capability.
create policy "workout_plan_items_trainer_delete" on public.workout_plan_items
  for delete using (public.is_trainer_of(auth.uid(), user_id));

create policy "meal_plan_items_trainer_delete" on public.meal_plan_items
  for delete using (public.is_trainer_of(auth.uid(), user_id));
