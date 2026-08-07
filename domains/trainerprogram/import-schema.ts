import { z } from "zod";

/**
 * What the AI is asked to extract from a trainer's free-form pasted
 * program (spreadsheet copy-paste, plain text, anything) — exercises are
 * named as free text (`exerciseName`), not library ids, since the model
 * has no knowledge of this trainer's exercise library; matching that
 * name to a real exercise (or creating a new 'review'-status one when
 * nothing matches) happens deterministically afterward in
 * import.ts, per CLAUDE.md rule 6 ("use deterministic code for
 * calculations"). Every field the manual builder can set is represented
 * here so nothing pasted gets silently dropped on the floor.
 */
export const importedExerciseSchema = z.object({
  exerciseName: z.string().min(1),
  /** Best-guess library metadata, used only if exerciseName doesn't
   * match anything already in the library — this becomes the new
   * exercise's row. */
  movementPattern: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  equipmentRequired: z.array(z.string()).default([]),
  primaryMuscleGroups: z.array(z.string()).default([]),
  sets: z.number().int().positive().nullable().default(null),
  repsMin: z.number().int().positive().nullable().default(null),
  repsMax: z.number().int().positive().nullable().default(null),
  intensityType: z.enum(["percent_1rm", "rpe", "none"]).nullable().default(null),
  intensityValue: z.string().nullable().default(null),
  durationMinutes: z.number().int().positive().nullable().default(null),
  cardioIntensity: z.string().nullable().default(null),
  coachingNotes: z.string().nullable().default(null),
});

export const importedSessionSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  name: z.string().nullable().default(null),
  sessionType: z.string().nullable().default(null),
  exercises: z.array(importedExerciseSchema).default([]),
});

export const importedPhaseSchema = z.object({
  name: z.string().min(1),
  focus: z.string().nullable().default(null),
  lengthWeeks: z.number().int().min(1).max(52).default(4),
  isFinal: z.boolean().default(false),
  sessions: z.array(importedSessionSchema).default([]),
});

export const trainerProgramImportSchema = z.object({
  /** If the pasted text has no clear program name, the model should
   * propose something reasonable rather than leaving it blank. */
  programName: z.string().min(1),
  phases: z.array(importedPhaseSchema).min(1),
});
export type TrainerProgramImport = z.infer<typeof trainerProgramImportSchema>;
