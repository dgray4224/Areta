-- Groundwork for imported health data (CLAUDE.md §14 Apple Health Roadmap).
-- weight_logs/sleep_logs already have `source` (default 'manual', unused by
-- any schema/service today); this adds the remaining provenance fields the
-- roadmap calls for — Device, Import timestamp, User override, Deduplication
-- key — so a future sync source (e.g. a HealthKit companion app posting to
-- /api/health-sync) can write real values instead of silently defaulting.
-- Manual entries leave these null; the partial unique index only constrains
-- rows that actually carry a dedup_key, so manual logging is unaffected.

alter table public.weight_logs
  add column device text,
  add column imported_at timestamptz,
  add column user_override boolean not null default false,
  add column dedup_key text;

create unique index weight_logs_user_dedup_key_idx
  on public.weight_logs (user_id, dedup_key)
  where dedup_key is not null;

alter table public.sleep_logs
  add column device text,
  add column imported_at timestamptz,
  add column user_override boolean not null default false,
  add column dedup_key text;

create unique index sleep_logs_user_dedup_key_idx
  on public.sleep_logs (user_id, dedup_key)
  where dedup_key is not null;
