-- grocery_lists and prep_plans need a per-week uniqueness constraint to
-- support the upsert-by-week pattern used by their generation services
-- (onConflict: "user_id,week_start") — missed in 0006, caught by manual
-- testing when approving a meal plan failed to build a grocery list.

alter table public.grocery_lists
  add constraint grocery_lists_user_week_key unique (user_id, week_start);

alter table public.prep_plans
  add constraint prep_plans_user_week_key unique (user_id, week_start);
