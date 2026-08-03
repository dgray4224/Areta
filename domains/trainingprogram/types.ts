export type TrainingProgram = {
  id: string;
  archetype: string;
  slug: string;
  name: string;
  description: string | null;
  methodologyNote: string | null;
  experienceLevel: "beginner" | "intermediate" | "advanced" | null;
  sessionsPerWeekMin: number;
  sessionsPerWeekMax: number;
  equipmentRequired: string[];
  isActive: boolean;
  displayOrder: number;
};

export type TrainingProgramPhase = {
  id: string;
  programId: string;
  phaseOrder: number;
  name: string;
  focus: string | null;
  lengthWeeks: number;
  intensityStyle: string | null;
  isFinal: boolean;
};

export type ProgramSession = {
  id: string;
  phaseId: string;
  sessionIndex: number;
  name: string | null;
  sessionType: string | null;
};

export type ProgramSessionExercise = {
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
  /** Null on the recommended/default prescription for a slot; set (to
   * that row's id) on each of its 1-2 alternates -- see
   * docs/training-content-pipeline.md. */
  primaryExerciseId: string | null;
};

/** A phase with its sessions and each session's exercise prescriptions
 * loaded, ready for domains/workoutplan/generate.ts to materialize into a
 * concrete week of workout_plan_items. */
export type HydratedProgramPhase = TrainingProgramPhase & {
  sessions: (ProgramSession & { exercises: ProgramSessionExercise[] })[];
};

/** Citation trail for a program's methodology -- what the on-demand
 * content pipeline's credibility gate checks before content ships (see
 * docs/training-content-pipeline.md). */
export type ProgramSource = {
  id: string;
  programId: string;
  organization: string;
  title: string;
  url: string;
  retrievedAt: string;
};
