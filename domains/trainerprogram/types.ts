/** Trainer-authored training programs (2026-08-06) — a trainer's own
 * reusable, multi-week program library, assignable to any of their
 * clients. Mirrors domains/trainingprogram/types.ts's shape (program ->
 * phases -> sessions -> session exercises) on purpose, so the same
 * block-periodization materialization pattern applies — see
 * supabase/migrations/0075_trainer_authored_programs.sql for the two
 * deliberate differences (trainer-owned, explicit day_of_week per
 * session). */

export type TrainerProgramStatus = "draft" | "published" | "archived";

export type TrainerProgram = {
  id: string;
  trainerId: string;
  name: string;
  description: string | null;
  status: TrainerProgramStatus;
  createdAt: string;
  updatedAt: string;
};

export type TrainerProgramPhase = {
  id: string;
  programId: string;
  phaseOrder: number;
  name: string;
  focus: string | null;
  lengthWeeks: number;
  isFinal: boolean;
};

export type TrainerProgramSession = {
  id: string;
  phaseId: string;
  dayOfWeek: number;
  name: string | null;
  sessionType: string | null;
};

export type TrainerProgramSessionExercise = {
  id: string;
  sessionId: string;
  exerciseOrder: number;
  exerciseId: string;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  intensityType: "percent_1rm" | "rpe" | "none" | null;
  intensityValue: string | null;
  durationMinutes: number | null;
  cardioIntensity: string | null;
  coachingNotes: string | null;
};

/** A phase with its sessions and each session's exercises loaded, ready
 * to display in the builder or hand to materializeTrainerProgramWeek. */
export type HydratedTrainerProgramPhase = TrainerProgramPhase & {
  sessions: (TrainerProgramSession & { exercises: TrainerProgramSessionExercise[] })[];
};

/** A program with every phase (unhydrated -- session/exercise detail
 * loaded separately per phase) for the builder's overview/outline view. */
export type TrainerProgramWithPhases = TrainerProgram & {
  phases: TrainerProgramPhase[];
};

export type TrainerProgramAssignmentStatus = "active" | "paused" | "ended";

export type TrainerProgramAssignment = {
  id: string;
  programId: string;
  programName: string;
  trainerId: string;
  clientId: string;
  status: TrainerProgramAssignmentStatus;
  /** When this program run began (or begins, if in the future) on the
   * calendar. Phase/week are no longer stored -- see
   * domains/trainerprogram/calendar-projection.ts, which computes them
   * fresh from this plus the program's phases for any given date. */
  startsOn: string;
  /** Hard cutoff (migration 0078) -- generateAndSaveFromTrainerProgram
   * auto-ends the assignment once today passes this instead of
   * generating further weeks. Required for every new assignment
   * (enforced in assignProgramToClient, not the database). */
  endDate: string | null;
  /** The tangible outcome the trainer stated when assigning -- also
   * created as a real goals-table row (linked_goal_id) so it shows up
   * on the client's own Goals list, not just here. */
  goalOutcome: string | null;
  /** Computed for "today" at load time, purely for display -- null if
   * startsOn is in the future (program hasn't started) or the program
   * has no phases. */
  currentPhaseName: string | null;
  currentWeekInPhase: number | null;
  startedAt: string;
  endedAt: string | null;
};

/** One row in a client's assignment archive (migration 0078's "programs
 * should stay in archive with the ability to recycle") -- always
 * status='ended', listed newest-first by domains/trainer/service.ts's
 * listClientAssignmentHistory. */
export type PastAssignment = {
  id: string;
  programId: string;
  programName: string;
  startsOn: string;
  endDate: string | null;
  goalOutcome: string | null;
  startedAt: string;
  endedAt: string | null;
};
