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
export type OnProgramComplete = "repeat" | "freeze";

export type TrainerProgramAssignment = {
  id: string;
  programId: string;
  programName: string;
  trainerId: string;
  clientId: string;
  status: TrainerProgramAssignmentStatus;
  onComplete: OnProgramComplete;
  currentPhaseId: string | null;
  currentPhaseName: string | null;
  phaseWeekNumber: number;
  startedAt: string;
  endedAt: string | null;
};
