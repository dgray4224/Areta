import type { TrainerProgramPhase, OnProgramComplete } from "@/domains/trainerprogram/types";

/**
 * Pure progression logic for a trainer-program assignment — deliberately
 * separate from materialize.ts (which does the actual database reads/
 * writes) so this can be unit tested without a Supabase client, same
 * reasoning as domains/workoutplan/rotation.ts.
 *
 * A trainer_program_assignments row's (current_phase_id, phase_week_number)
 * is always a forward pointer: "the phase/week to use the next time a new
 * week is generated" — never "the last one generated". This function's
 * job is to compute what that pointer should become *after* the phase/
 * week it currently points to has just been used for a materialized
 * week, i.e. call it once per newly-generated week, not on a same-week
 * regenerate (see materialize.ts's existingPlan check for why).
 */
export function resolveTrainerProgramProgression(input: {
  /** The phase just materialized (the assignment's pointer before this
   * call). */
  currentPhase: TrainerProgramPhase;
  /** The week-within-currentPhase just materialized. */
  currentWeekNumber: number;
  /** The phase after currentPhase in the same program, or null if
   * currentPhase is the last one (or is_final). */
  nextPhase: TrainerProgramPhase | null;
  /** The program's first phase, used to loop back on 'repeat'. */
  firstPhase: TrainerProgramPhase;
  onComplete: OnProgramComplete;
}): { phaseId: string; weekNumber: number } {
  const { currentPhase, currentWeekNumber, nextPhase, firstPhase, onComplete } = input;

  if (currentWeekNumber < currentPhase.lengthWeeks) {
    return { phaseId: currentPhase.id, weekNumber: currentWeekNumber + 1 };
  }
  if (nextPhase) {
    return { phaseId: nextPhase.id, weekNumber: 1 };
  }
  if (onComplete === "repeat") {
    return { phaseId: firstPhase.id, weekNumber: 1 };
  }
  // freeze: keep pointing at the final week of the final phase
  // indefinitely, so every future week replays identical content until
  // the trainer assigns something new.
  return { phaseId: currentPhase.id, weekNumber: currentPhase.lengthWeeks };
}
