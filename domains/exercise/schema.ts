import { z } from "zod";

/** Curated training archetypes — a fixed, deterministic-friendly list
 * (mirrors nutrition's ACTIVITY_LEVELS) rather than free text, since the
 * Outcome-to-Operating-Parameters engine (domains/parameters/exercise-calc.ts)
 * keys its periodization/volume rules off this value. */
export const EXERCISE_ARCHETYPES = [
  "long_distance_runner",
  "powerlifter",
  "hybrid_athlete",
  "general_fitness",
  "hypertrophy",
] as const;
export type ExerciseArchetype = (typeof EXERCISE_ARCHETYPES)[number];

export const EXERCISE_ARCHETYPE_LABELS: Record<ExerciseArchetype, string> = {
  long_distance_runner: "Long-distance runner",
  powerlifter: "Powerlifter / strength-focused",
  hybrid_athlete: "Hybrid athlete (strength + endurance)",
  general_fitness: "General fitness / health",
  hypertrophy: "Muscle building / hypertrophy",
};

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Suggested chip options for equipment access — a starting point the user
 * can add to, not an exhaustive list. Also what the workout-plan generator
 * (domains/workoutplan/generate.ts) filters the exercise library against. */
export const EQUIPMENT_SUGGESTIONS = [
  "Barbell",
  "Dumbbells",
  "Kettlebells",
  "Pull-up bar",
  "Cardio machine",
  "Full gym access",
  "Bodyweight only",
];

export const exerciseSchema = z.object({
  archetype: z.enum(EXERCISE_ARCHETYPES).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  trainingPhaseLengthWeeks: z.number().int().positive().optional(),
  daysPerWeekAvailable: z.number().int().min(1).max(7).optional(),
  sessionLengthMinutesAvailable: z.number().int().positive().optional(),
  equipmentAccess: z.array(z.string()).optional(),
  /** Light and non-clinical on purpose — a real injury/rehab situation
   * belongs in the Recovery module (CLAUDE.md §11), not here. */
  physicalLimitations: z.string().optional(),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const exerciseLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  archetype: z.enum(EXERCISE_ARCHETYPES).optional(),
  durationMinutes: z.number().int().min(0).optional(),
  perceivedExertion: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export type ExerciseLogInput = z.infer<typeof exerciseLogSchema>;
