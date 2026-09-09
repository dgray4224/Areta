-- Planning preferences the week bends to (product decision 2026-09-09: the
-- week is the cadence of adjustment, not a rule about how people live).
-- Stored on profiles because the generators and the mobile Settings screen
-- already read and write profiles directly.
--
--   shopping_horizon_weeks  how many weeks of meals to plan at once, and the
--                           span of the one consolidated grocery list
--   meal_planning_enabled   false = "training only": no meal plan, no
--                           grocery list, no prep plan; food logging stays

alter table public.profiles
  add column shopping_horizon_weeks smallint not null default 1
    check (shopping_horizon_weeks between 1 and 4),
  add column meal_planning_enabled boolean not null default true;

-- Column-level grants follow 0065_profiles_column_privileges.sql: the
-- authenticated role only sees and edits the columns listed there, so new
-- columns are invisible to the app until granted.
grant select (shopping_horizon_weeks, meal_planning_enabled) on public.profiles to authenticated;
grant update (shopping_horizon_weeks, meal_planning_enabled) on public.profiles to authenticated;
