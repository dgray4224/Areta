import type { ExerciseArchetype, ExperienceLevel } from "@/domains/exercise/schema";

/**
 * The pre-goal-first Exercise onboarding shape (archetype chosen
 * directly, no primaryGoal). Frozen here so the still-live old
 * pipeline (domains/workoutplan/rotation.ts, generate.ts, service.ts,
 * domains/parameters/exercise-calc.ts) keeps typechecking against
 * exactly what it always read, even though domains/exercise/schema.ts's
 * exerciseSchema/ExerciseInput now describes the new shape. Retire this
 * file once that old pipeline is fully replaced (goal-first plan,
 * Phase 4) and confirmed to have zero remaining callers.
 */
export type LegacyExerciseInput = {
  archetype?: ExerciseArchetype;
  experienceLevel?: ExperienceLevel;
  trainingPhaseLengthWeeks?: number;
  daysPerWeekAvailable?: number;
  sessionLengthMinutesAvailable?: number;
  equipmentAccess?: string[];
  physicalLimitations?: string;
};

/**
 * True when a stored `onboarding_responses.exercise` value is still in
 * the old archetype-first shape (has a truthy `archetype`) rather than
 * the new goal-first shape (has `primaryGoal`). Used to force
 * already-onboarded users back through onboarding once in the new
 * shape, and to gate the old plan-generation pipeline off of new-shape
 * data it can't understand yet.
 */
export function isLegacyExerciseShape(exercise: unknown): exercise is LegacyExerciseInput {
  if (typeof exercise !== "object" || exercise === null) return false;
  const candidate = exercise as Record<string, unknown>;
  return Boolean(candidate.archetype) && !candidate.primaryGoal;
}
