-- Admin portal, phase D: ai_runs and workout_plans have both been
-- RLS-scoped to each user's own rows (ai_runs_all_own /
-- workout_plans_all_own, migrations 0008/0010) since they were created —
-- no cross-user visibility has ever existed. The ops viewer needs to read
-- every user's rows for both (an AI-run log viewer, and a live count of
-- stale active workout plans as a cron-health proxy), gated to owner
-- only (not reviewer) since ops/user data is more sensitive than the
-- Phase B/C content-review and content-management tables.
-- is_admin_owner() (added in migration 0052) has had no real caller
-- until this.
create policy "ai_runs_admin_select" on public.ai_runs
  for select using (public.is_admin_owner(auth.uid()));

create policy "workout_plans_admin_select" on public.workout_plans
  for select using (public.is_admin_owner(auth.uid()));
