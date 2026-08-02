-- Adds the distinct workout activity types logged on a given day (deduped,
-- in chronological first-occurrence order -- e.g. ['Running', 'Weightlifting']
-- for a day with a morning run and an evening lift), plus day_of_week/
-- is_weekend as generated columns since they're pure deterministic
-- functions of `day` -- computing them at the DB level means they can
-- never drift out of sync with `day`, and Postgres auto-populates them for
-- existing rows on this ALTER (no backfill needed for these two).
-- workout_activity_types on existing rows needs a backfill re-run since
-- it's a plain default, not derivable from data already in this table.

alter table public.activity_daily_summaries
  add column workout_activity_types text[] not null default '{}',
  add column day_of_week smallint generated always as (extract(dow from day)::smallint) stored,
  add column is_weekend boolean generated always as (extract(dow from day) in (0, 6)) stored;
