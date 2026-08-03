-- Adds a free-text notes field to every kind of item the mobile "At a
-- Glance" timeline can place, plus a completion concept for custom
-- timeline events (workout/meal completion already existed -- see
-- migration 0020). Powers the new tap-to-open detail view: a workout's
-- individual exercises each get their own note (mirrors the per-exercise
-- checkbox split already established), a meal or custom event gets one.

alter table public.workout_plan_items
  add column notes text;

alter table public.meal_plan_items
  add column notes text;

alter table public.custom_timeline_events
  add column completed_at timestamptz,
  add column notes text;
