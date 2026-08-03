-- Distinguishes a planned/dragged schedule_events row from one derived
-- from actual synced behavior (currently only workouts have both: the
-- user drags a planned time on the mobile timeline, and HealthKit
-- separately syncs when the workout actually happened). Actual behavior
-- is the stronger signal for learning someone's real routine, so it must
-- never be silently overwritten by a later planned write for the same
-- day -- see domains/workoutplan/service.ts's setWorkoutPlanItemScheduledTime
-- and domains/workout/service.ts's insertImportedWorkoutLog.

alter table public.schedule_events
  add column source text not null default 'planned' check (source in ('planned', 'actual'));
