-- Requested 2026-08-06: every program assignment needs a stated end date
-- and a tangible outcome, for transparency between trainer and client and
-- so the outcome shows up as a real goal on the client's own profile.
--
-- end_date/goal_outcome are nullable at the database level rather than
-- not-null -- there's no sensible default for either (unlike starts_on,
-- which reasonably defaults to today), and a hard not-null constraint
-- would force a backfill decision for any pre-existing row with neither.
-- "Required" is enforced in assignProgramToClient itself (domains/
-- trainer/service.ts), same as how e.g. trainer_program_session_exercises
-- requires an exerciseId at the application layer despite the column
-- allowing it structurally. linked_goal_id points at the real goals row
-- created alongside the assignment (ON DELETE SET NULL -- if the goal is
-- later deleted directly, the assignment shouldn't cascade-delete too).
--
-- Hard cutoff, not just informational: once end_date passes,
-- generateAndSaveFromTrainerProgram (domains/trainerprogram/
-- materialize.ts) auto-ends the assignment (status='ended') instead of
-- generating further weeks. Ended assignments are never deleted --
-- they're the archive the trainer can reassign (with modifications, by
-- editing the program first) later; no schema change needed for that,
-- domains/trainer/service.ts's listClientAssignmentHistory just reads
-- status='ended' rows.

alter table public.trainer_program_assignments
  add column end_date date,
  add column goal_outcome text,
  add column linked_goal_id uuid references public.goals (id) on delete set null;
