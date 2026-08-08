-- Third plan-source family for workout_plans: goal-first program
-- templates (migration 0044's program_templates), alongside the legacy
-- shared-library family (program_id/program_phase_id, migration 0030)
-- and the trainer-authored family (trainer_program_id/
-- trainer_program_phase_id, migration 0075). Same precedent as 0075:
-- additive, a given plan is tagged with exactly one family depending on
-- where it came from. phase_week_number (0030) is reused as-is for
-- template-phase week tracking -- it's a bare smallint with no FK, so
-- it's family-agnostic already.
--
-- This is the first migration of the goal-first recommendation engine
-- work (domains/recommendation/*) that finally consumes 0044's schema;
-- workout_plan_items.template_slot_id + provenance already exist there.
alter table public.workout_plans
  add column template_id uuid references public.program_templates (id),
  add column template_phase_id uuid references public.template_phases (id);
