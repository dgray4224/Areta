-- Adds completion tracking to plan items, powering the mobile app's
-- Exercise/Nutrition tab checkboxes. Neither workout_plan_items nor
-- meal_plan_items has ever had a completion concept before this.
--
-- workout_plan_items: a pure boolean-via-timestamp flag. No auto-generated
-- log row -- HealthKit's workout_logs already captures "what actually
-- happened" independently (synced automatically), so this checkbox is
-- purely "did I follow today's plan," not a data-capture mechanism.
--
-- meal_plan_items: completing also writes a real nutrition_logs row
-- derived from the recipe's known macros (see
-- domains/mealplan/service.ts's setMealPlanItemCompleted), so checking the
-- box both marks completion and captures real nutrition data without the
-- user re-typing it. nutrition_log_id links to that row so un-completing
-- can cleanly remove it again.

alter table public.workout_plan_items
  add column completed_at timestamptz;

alter table public.meal_plan_items
  add column completed_at timestamptz,
  add column nutrition_log_id uuid references public.nutrition_logs(id) on delete set null;
