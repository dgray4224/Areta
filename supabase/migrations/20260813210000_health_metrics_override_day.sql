-- Phase 3 of the enhancement roadmap (2026-08-13): a manual correction
-- needs a "day" to attach to, since the existing per-dedup_key
-- user_override guard in insertImportedHealthMetric can never fire for a
-- manual correction (a manual entry has no HealthKit sample UUID to match
-- against). override_day is only ever set on manually-overridden rows
-- (the upsert path always pairs it with user_override = true) -- imported
-- rows leave it null. The partial index keeps it cheap despite being
-- unindexed-for-most-rows.
alter table public.health_metrics add column override_day date;

create index health_metrics_user_metric_override_day_idx
  on public.health_metrics (user_id, metric_type, override_day)
  where user_override = true;
