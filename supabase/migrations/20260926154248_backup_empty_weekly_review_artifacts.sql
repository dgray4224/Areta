-- Safety net for the 2026-09-26 cleanup of weekly_reviews rows left by the
-- sliding-window bug (reviewWeekStart returned `today - 6`, so opening the
-- app on a new day created another row keyed to another arbitrary date).
--
-- Captures only rows carrying nothing a person produced: no brief, no
-- answers, never approved. Their metrics are recomputable from the raw logs
-- regardless, so this exists to make the cleanup reversible rather than
-- because the contents are irreplaceable.
--
-- The cleanup itself was a one-off statement run against production
-- alongside this migration, deliberately NOT included here: replaying these
-- migrations into a fresh database must never delete anything, and a fresh
-- database has no artifacts to clean in the first place. It removed exactly
-- the 66 ids captured below, leaving 44 rows -- 43 briefs, 5 answer sets, 2
-- approvals -- untouched.
--
-- Safe to drop this table once the cleanup is confirmed good.
create table if not exists public.weekly_reviews_artifact_backup_20260926 as
select * from public.weekly_reviews
where brief is null
  and status = 'draft'
  and (answers is null or answers = '{}'::jsonb)
  and approved_at is null
  and backfilled = false;

-- RLS on with NO policies: denies every client role outright, leaving only
-- service_role (which bypasses RLS) able to read it. The August 2026
-- incident was backup tables holding health data that were readable through
-- the public API; this one must not repeat that.
alter table public.weekly_reviews_artifact_backup_20260926 enable row level security;

revoke all on public.weekly_reviews_artifact_backup_20260926 from anon, authenticated;

comment on table public.weekly_reviews_artifact_backup_20260926 is
  'Backup of empty weekly_reviews rows deleted 2026-09-26 (sliding-window key bug). No briefs, answers or approvals. Drop once the cleanup is confirmed.';
