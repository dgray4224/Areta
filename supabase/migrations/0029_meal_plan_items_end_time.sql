-- Meals get the same start+end time concept custom_timeline_events
-- already has (migration 0028) -- the mobile edit sheet's dual picker now
-- applies to meals too, not just custom events. Nullable the same way:
-- an unscheduled meal has no end_time either.

alter table public.meal_plan_items
  add column end_time time;
