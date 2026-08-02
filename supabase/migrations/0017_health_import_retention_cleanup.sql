-- Product-wide, one-time cleanup of health-log data older than the 3-year
-- retention window (CLAUDE.md §14 Apple Health Roadmap /
-- platform/health/retention.ts). This is real, irreversible deletion across
-- every user's account, not scoped to one user — it corrects data that was
-- backfilled by a bug in the mobile app's anchor-based sync (unfiltered
-- HKAnchoredObjectQuery got stuck deep in old history before this fix
-- landed). Applies uniformly to manual and imported rows alike in
-- weight_logs/sleep_logs (the two tables with a manual-entry path) — per
-- product decision, the retention window is data-age-based, not
-- source-based.

delete from public.weight_logs where logged_at < now() - interval '3 years';
delete from public.sleep_logs where date < (now() - interval '3 years')::date;
delete from public.step_logs where logged_at < now() - interval '3 years';
delete from public.heart_rate_logs where logged_at < now() - interval '3 years';
delete from public.workout_logs where start_date < now() - interval '3 years';
