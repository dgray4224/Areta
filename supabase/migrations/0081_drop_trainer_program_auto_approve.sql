-- Requested 2026-08-07: the founder drew a clear line on CLAUDE.md rule
-- 10 ("require approval before changing active plans") -- it protects a
-- user's *own* self-service plan generation, not a trainer acting on a
-- client who already consented to that trainer's access by accepting
-- them. auto_approve (migration 0080) was an opt-in per-client toggle for
-- exactly that distinction; now that every trainer-program materialization
-- always writes straight to 'active' (domains/trainerprogram/materialize.ts's
-- materializeWeek no longer branches on it at all), the column has
-- nothing left to control.
alter table public.trainer_program_assignments drop column auto_approve;
