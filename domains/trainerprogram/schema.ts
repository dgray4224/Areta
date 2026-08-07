import { z } from "zod";

export const trainerProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type TrainerProgramInput = z.infer<typeof trainerProgramSchema>;

export const trainerProgramPhaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  focus: z.string().optional(),
  lengthWeeks: z.number().int().min(1, "Must run at least 1 week").max(52),
  isFinal: z.boolean(),
});
export type TrainerProgramPhaseInput = z.infer<typeof trainerProgramPhaseSchema>;

export const trainerProgramSessionSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  name: z.string().optional(),
  sessionType: z.string().optional(),
});
export type TrainerProgramSessionInput = z.infer<typeof trainerProgramSessionSchema>;

export const trainerProgramSessionExerciseSchema = z.object({
  exerciseId: z.string().uuid("Choose an exercise"),
  sets: z.number().int().positive().optional(),
  repsMin: z.number().int().positive().optional(),
  repsMax: z.number().int().positive().optional(),
  intensityType: z.enum(["percent_1rm", "rpe", "none"]).optional(),
  intensityValue: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  cardioIntensity: z.string().optional(),
  coachingNotes: z.string().optional(),
});
export type TrainerProgramSessionExerciseInput = z.infer<typeof trainerProgramSessionExerciseSchema>;

/** A trainer adding a brand-new exercise while building a program
 * (status is always forced to 'review' server-side, not accepted from
 * the client -- see createExerciseAsTrainer). Deliberately a much
 * smaller field set than the admin editor's exerciseAdminSchema: a
 * trainer is describing one exercise well enough to prescribe it, not
 * authoring full library metadata (aliases, secondary muscle groups,
 * limitation tags). Admin can enrich it later during review. */
export const trainerExerciseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  movementPattern: z.string().min(1, "Movement pattern is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  equipmentRequired: z.array(z.string()),
  primaryMuscleGroups: z.array(z.string()),
  archetypeTags: z.array(z.string()),
  instructions: z.string().optional(),
});
export type TrainerExerciseInput = z.infer<typeof trainerExerciseSchema>;
