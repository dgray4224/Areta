-- Critical fix, found 2026-08-13 while verifying Phase 3 (day-level
-- override guard): health_metrics_dedup_idx (created by
-- create_health_metrics, 2026-08-07 -- never mirrored to a local
-- migration file in this repo, only discoverable via the live schema)
-- is a PARTIAL unique index ("... WHERE dedup_key IS NOT NULL").
-- insertImportedHealthMetric's upsert uses plain
-- `ON CONFLICT (user_id, metric_type, dedup_key)` inference, which
-- Postgres can ONLY match against a full (non-partial) unique
-- index/constraint -- it silently cannot match a partial one at all,
-- regardless of whether the incoming row's dedup_key is actually
-- non-null. Every real HealthKit import since 2026-08-07 has been
-- failing with "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" (confirmed: zero successful imports
-- in the 7 days before this fix, most recent successful import was
-- 2026-08-05 -- i.e. this broke sync for every single user for over a
-- week, silently).
--
-- The partial predicate was unnecessary in the first place: a plain
-- (non-partial) unique index already allows unlimited NULL dedup_keys
-- (manual entries) without conflict -- NULL is never considered equal
-- to another NULL in a unique index. Dropping the WHERE clause changes
-- nothing about manual-entry behavior and fixes ON CONFLICT inference
-- for every import going forward.
drop index public.health_metrics_dedup_idx;

create unique index health_metrics_dedup_idx
  on public.health_metrics (user_id, metric_type, dedup_key);
