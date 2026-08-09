-- ============================================================
-- Fix: workout_plan_item_alternatives has no INSERT policy
--
-- 0044_goal_first_training_schema.sql enabled RLS on this table and
-- added only a SELECT policy (workout_plan_item_alternatives_select_own).
-- Every write path that persists a plan's top-2 runner-up alternates
-- (domains/workoutplan/service.ts's generateAndSaveGoalFirstPlan) runs
-- through whatever RLS-scoped client the caller passed in -- the user's
-- own session (onboarding, the web "Generate" button), a bearer token
-- (mobile's /api/plan/workouts/generate), or the cron route's per-user
-- client -- never a service-role client. With no INSERT policy, every
-- one of those inserts has been silently rejected
-- ("new row violates row-level security policy") since this table
-- shipped; the code already treats that failure as a non-fatal warning
-- (alternates are "an enhancement, not plan content"), so plan
-- generation itself never failed or surfaced an error -- it just never
-- actually saved any alternates for anyone. Discovered 2026-08-08 via
-- the mobile "Customize this week" flow (Plan-tab-overhaul Phase G),
-- the first UI surface that actually displays generation warnings.
--
-- Same ownership check as the existing SELECT policy: only lets a user
-- insert an alternate row for a workout_plan_item they themselves own.
-- ============================================================
create policy "workout_plan_item_alternatives_insert_own" on public.workout_plan_item_alternatives
  for insert with check (
    exists (
      select 1 from public.workout_plan_items wpi
      where wpi.id = workout_plan_item_alternatives.workout_plan_item_id
        and wpi.user_id = auth.uid()
    )
  );
