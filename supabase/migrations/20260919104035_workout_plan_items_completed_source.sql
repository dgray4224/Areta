-- Where a completed tick came from.
--
-- Planned training can now be marked done from an Apple Health workout
-- on the same day (domains/workoutplan/auto-complete.ts), which is the
-- point of a product that claims to work from what actually happened.
-- But an inference and a person's own tap are not the same statement,
-- and the coach reasons out loud from this data, so the two provenances
-- stay distinguishable: the UI can say where a tick came from, and the
-- brief can hedge an inferred one without hedging a real one.
--
-- Null means either not complete, or completed before 2026-09-19.
alter table public.workout_plan_items
  add column if not exists completed_source text
  check (completed_source is null or completed_source in ('manual', 'health'));

comment on column public.workout_plan_items.completed_source is
  'How the item came to be complete: manual (the person ticked it) or health (inferred from an Apple Health workout on that day). Null for rows completed before 2026-09-19, and for anything not complete.';

grant select (completed_source), update (completed_source) on public.workout_plan_items to authenticated;
