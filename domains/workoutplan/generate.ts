import type { Exercise } from "@/domains/exerciselibrary/types";

export type PlannedExercise = {
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
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

function hasEquipment(exercise: Exercise, equipmentAccess: string[]): boolean {
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
      });
      usedToday.add(chosen.id);
      usageCount.set(chosen.id, (usageCount.get(chosen.id) ?? 0) + 1);
    }

    planDays.push({ dayOfWeek: day, isRestDay: false, exercises });
  }

  return { days: planDays, warnings };
}
