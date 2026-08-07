-- Restores trainer read access to client health data, lost when
-- weight_logs/sleep_logs/step_logs/heart_rate_logs/workout_logs were
-- consolidated into health_metrics (health_metrics only got the owner-only
-- "health_metrics_all_own" policy -- the *_trainer_select policies from
-- 0066_trainer_role_foundation.sql are still attached to the renamed,
-- now-dormant *_deprecated_migrated tables, which nothing reads anymore).
-- Same read-only semantics as the originals: select only, no
-- insert/update/delete for a trainer on a client's logged health data.
create policy "health_metrics_trainer_select" on public.health_metrics
  for select using (public.is_trainer_of(auth.uid(), user_id));
