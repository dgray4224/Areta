import type { Exercise } from "@/domains/exerciselibrary/types";
import type { HydratedProgramPhase } from "@/domains/trainingprogram/types";

export type PlannedExercise = {
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
  /** Non-null only when materialized from a training_programs phase
   * (materializeWorkoutPlan) rather than the legacy archetype-only
   * generator (generateWorkoutPlan). */
  programSessionExerciseId: string | null;
  repsMin: number | null;
  repsMax: number | null;
  intensityType: "percent_1rm" | "rpe" | "none" | null;
  intensityValue: string | null;
  cardioIntensity: string | null;
  coachingNotes: string | null;
  substituted: boolean;
};

export type WorkoutPlanDay = {
  dayOfWeek: number;
  isRestDay: boolean;
  exercises: PlannedExercise[];
};

export type WorkoutPlanGenerationInput = {
  sessionsPerWeek: number;
  archetype: string;
  /** From the Exercise onboarding step's "select all that apply" equipment
   * field. "Full gym access" acts as a wildcard satisfying any specific
   * equipment requirement, so a user doesn't have to separately re-select
   * every individual piece of equipment a full gym implies. */
  equipmentAccess: string[];
  exercises: Exercise[];
  exercisesPerSession?: number;
  days?: number;
};

export type WorkoutPlanGenerationResult = {
  days: WorkoutPlanDay[];
  warnings: string[];
};

const DEFAULT_EXERCISES_PER_SESSION = 5;
const MAX_USES_PER_WEEK = 2;
const CARDIO_PATTERNS = ["aerobic", "anaerobic / speed", "aerobic / conditioning"];

export function hasEquipment(exercise: Exercise, equipmentAccess: string[]): boolean {
  const wildcard = equipmentAccess.includes("Full gym access");
  return exercise.equipmentRequired.every((eq) => wildcard || equipmentAccess.includes(eq));
}

/**
 * Deterministic, rule-based weekly workout schedule generator (mirrors
 * domains/mealplan/generate.ts). No AI — approved Exercise parameters +
 * the shared exercise library + a greedy variety-respecting selection do
 * the work, matching CLAUDE.md rule 6.
 */
export function generateWorkoutPlan(input: WorkoutPlanGenerationInput): WorkoutPlanGenerationResult {
  const days = input.days ?? 7;
  const exercisesPerSession = input.exercisesPerSession ?? DEFAULT_EXERCISES_PER_SESSION;
  const warnings: string[] = [];

  let eligible = input.exercises.filter(
    (e) => e.archetypeTags.includes(input.archetype) && hasEquipment(e, input.equipmentAccess)
  );
  if (eligible.length === 0) {
    warnings.push(
      "No exercises matched your archetype and equipment access — showing archetype matches regardless of equipment."
    );
    eligible = input.exercises.filter((e) => e.archetypeTags.includes(input.archetype));
  }
  if (eligible.length === 0) {
    warnings.push("No exercises matched your archetype at all — showing the full library.");
    eligible = input.exercises;
  }

  const sessionsPerWeek = Math.min(Math.max(input.sessionsPerWeek, 0), days);
  // Spread session days evenly across the week rather than always Mon-Fri.
  const sessionDayIndices = new Set<number>();
  if (sessionsPerWeek > 0) {
    const gap = days / sessionsPerWeek;
    for (let i = 0; i < sessionsPerWeek; i++) {
      sessionDayIndices.add(Math.floor(i * gap));
    }
  }

  const usageCount = new Map<string, number>();
  const planDays: WorkoutPlanDay[] = [];

  for (let day = 0; day < days; day++) {
    if (!sessionDayIndices.has(day)) {
      planDays.push({ dayOfWeek: day, isRestDay: true, exercises: [] });
      continue;
    }

    const usedToday = new Set<string>();
    const exercises: PlannedExercise[] = [];

    for (let slot = 0; slot < exercisesPerSession; slot++) {
      const underCap = eligible.filter(
        (e) => !usedToday.has(e.id) && (usageCount.get(e.id) ?? 0) < MAX_USES_PER_WEEK
      );
      const pool = underCap.length > 0 ? underCap : eligible.filter((e) => !usedToday.has(e.id));
      if (pool.length === 0) break;

      const chosen = pool[slot % pool.length];
      const isCardio = CARDIO_PATTERNS.some((p) => chosen.movementPattern.includes(p.split(" ")[0]));

      exercises.push({
        exerciseId: chosen.id,
        sets: isCardio ? null : 3,
        reps: isCardio ? null : 10,
        durationMinutes: isCardio ? 30 : null,
        programSessionExerciseId: null,
        repsMin: null,
        repsMax: null,
        intensityType: null,
        intensityValue: null,
        cardioIntensity: null,
        coachingNotes: null,
        substituted: false,
      });
      usedToday.add(chosen.id);
      usageCount.set(chosen.id, (usageCount.get(chosen.id) ?? 0) + 1);
    }

    planDays.push({ dayOfWeek: day, isRestDay: false, exercises });
  }

  return { days: planDays, warnings };
}

export type MaterializeWorkoutPlanInput = {
  phase: HydratedProgramPhase;
  archetype: string;
  equipmentAccess: string[];
  exercises: Exercise[];
  days?: number;
};

export type MaterializeWorkoutPlanResult = {
  days: WorkoutPlanDay[];
  warnings: string[];
};

/**
 * Substitutes an equipment-incompatible prescribed exercise for the
 * closest available alternative, relaxing the match one tier at a time:
 * same movement pattern + shared archetype, then shared muscle group +
 * archetype, then archetype alone. Returns null (keep the original,
 * unsubstituted) if nothing in the library qualifies even at the loosest
 * tier.
 */
function findSubstitute(
  original: Exercise,
  archetype: string,
  equipmentAccess: string[],
  allExercises: Exercise[]
): Exercise | null {
  const candidates = allExercises.filter((e) => e.id !== original.id && hasEquipment(e, equipmentAccess));

  const byMovementAndArchetype = candidates.find(
    (e) => e.movementPattern === original.movementPattern && e.archetypeTags.includes(archetype)
  );
  if (byMovementAndArchetype) return byMovementAndArchetype;

  const byMuscleAndArchetype = candidates.find(
    (e) => e.archetypeTags.includes(archetype) && e.primaryMuscleGroups.some((m) => original.primaryMuscleGroups.includes(m))
  );
  if (byMuscleAndArchetype) return byMuscleAndArchetype;

  const byArchetypeOnly = candidates.find((e) => e.archetypeTags.includes(archetype));
  if (byArchetypeOnly) return byArchetypeOnly;

  return null;
}

/**
 * Turns a fully-hydrated training_programs phase (domains/trainingprogram/
 * service.ts's getProgramPhaseHydrated) into a concrete week of
 * workout_plan_items, reusing the same day-spreading approach as
 * generateWorkoutPlan (sessions distributed evenly across the week rather
 * than always Mon-Fri). Each session's exercise prescriptions are used
 * as-is when the user has the required equipment; otherwise the closest
 * available substitute is used and flagged.
 */
export function materializeWorkoutPlan(input: MaterializeWorkoutPlanInput): MaterializeWorkoutPlanResult {
  const days = input.days ?? 7;
  const warnings: string[] = [];
  const exercisesById = new Map(input.exercises.map((e) => [e.id, e]));

  const sessions = input.phase.sessions;
  const sessionsPerWeek = Math.min(Math.max(sessions.length, 0), days);

  const sessionDayIndices: number[] = [];
  if (sessionsPerWeek > 0) {
    const gap = days / sessionsPerWeek;
    for (let i = 0; i < sessionsPerWeek; i++) {
      sessionDayIndices.push(Math.floor(i * gap));
    }
  }

  const planDays: WorkoutPlanDay[] = [];
  let sessionCursor = 0;

  for (let day = 0; day < days; day++) {
    if (!sessionDayIndices.includes(day)) {
      planDays.push({ dayOfWeek: day, isRestDay: true, exercises: [] });
      continue;
    }

    const session = sessions[sessionCursor];
    sessionCursor++;

    const plannedExercises: PlannedExercise[] = [];
    for (const prescription of session?.exercises ?? []) {
      const original = exercisesById.get(prescription.exerciseId);
      if (!original) {
        warnings.push("A prescribed exercise is missing from the library and was skipped.");
        continue;
      }

      let chosen = original;
      let substituted = false;
      if (!hasEquipment(original, input.equipmentAccess)) {
        const substitute = findSubstitute(original, input.archetype, input.equipmentAccess, input.exercises);
        if (substitute) {
          chosen = substitute;
          substituted = true;
        } else {
          warnings.push(`No equipment-compatible substitute found for "${original.name}" -- kept as prescribed.`);
        }
      }

      plannedExercises.push({
        exerciseId: chosen.id,
        sets: prescription.sets,
        reps: prescription.repsMax ?? prescription.repsMin,
        durationMinutes: prescription.durationMinutes,
        programSessionExerciseId: prescription.id,
        repsMin: prescription.repsMin,
        repsMax: prescription.repsMax,
        intensityType: prescription.intensityType,
        intensityValue: prescription.intensityValue,
        cardioIntensity: prescription.cardioIntensity,
        coachingNotes: prescription.coachingNotes,
        substituted,
      });
    }

    planDays.push({ dayOfWeek: day, isRestDay: false, exercises: plannedExercises });
  }

  return { days: planDays, warnings };
}
