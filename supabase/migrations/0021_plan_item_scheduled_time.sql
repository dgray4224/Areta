-- Adds a user-assignable clock time to plan items, powering the mobile
-- app's "At a Glance" drag-and-drop timeline. Neither table has ever had a
-- time-of-day column before this -- only day_of_week, and for meals a
-- loose breakfast/lunch/dinner/snack category. `time` (not timestamptz or
-- integer-minutes) matches profiles.wake_time/bed_time's existing
-- "day-relative, no date" semantics: these tables have no date to anchor a
-- timestamptz to, and Postgres sorts/compares `time` natively.

alter table public.workout_plan_items add column scheduled_time time;
alter table public.meal_plan_items add column scheduled_time time;
