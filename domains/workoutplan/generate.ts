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
  /** exerciseId -> how many times the user has explicitly assigned it
   * (domains/workoutplan/preferences.ts#getExercisePickFrequency). Unlike
   * generateMealPlan's scored selection, this generator's slot choice is
   * a round-robin index into `eligible`, so there's no scoreOf to add a
   * bonus term to -- instead the eligible pool is reordered
   * (higher-pick-count first, stable sort) before round-robin selection,
   * leaving the existing cap/variety filtering completely untouched.
   * Omitted/empty leaves output byte-identical to today. */
  pickWeights?: Map<string, number>;
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
  if (eligible.length > 0 && eligible.length < exercisesPerSession) {
    warnings.push(
      `Only ${eligible.length} exercise${eligible.length === 1 ? "" : "s"} matched your archetype and equipment access, so sessions repeat ${eligible.length === 1 ? "it" : "them"} to reach a full ${exercisesPerSession}-exercise workout — add equipment access in your Exercise settings for more variety.`
    );
  }

  if (input.pickWeights && input.pickWeights.size > 0) {
    const pickWeights = input.pickWeights;
    // Stable sort -- anything with equal (usually zero) pick counts keeps
    // its existing relative order, so a brand-new user with no history
    // sees byte-identical output to before this feature existed.
    eligible = [...eligible].sort((a, b) => (pickWeights.get(b.id) ?? 0) - (pickWeights.get(a.id) ?? 0));
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
      const notUsedToday = eligible.filter((e) => !usedToday.has(e.id));
      // Last resort: the eligible pool is small enough that every exercise
      // has already appeared in this session. Rather than silently ending
      // the session short (previously: `if (pool.length === 0) break`,
      // which could leave a day with just 1-2 exercises when the
      // archetype/equipment filter is narrow), cycle back through the full
      // eligible pool so the session always reaches its target length.
      const pool = underCap.length > 0 ? underCap : notUsedToday.length > 0 ? notUsedToday : eligible;
      if (pool.length === 0) break; // only possible when eligible itself is empty

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
  /** The user's actual requested weekly training frequency (their
   * approved `sessions_per_week` parameter). Previously unused --
   * sessionsPerWeek was derived purely from however many sessions
   * happened to be authored in the phase, silently ignoring what the
   * user asked for on both sides (fewer scheduled days than requested
   * when a phase was authored thin, or more than requested when it
   * wasn't). When the phase has fewer authored sessions than this,
   * sessions are cycled/repeated to reach it; when it has more, only
   * the first `sessionsPerWeek` are scheduled. Defaults to
   * `phase.sessions.length` (the old behavior) when omitted, so
   * existing callers that don't pass it are unaffected. */
  sessionsPerWeek?: number;
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
  const requestedSessionsPerWeek = input.sessionsPerWeek ?? sessions.length;
  // No authored sessions means nothing to schedule regardless of what was
  // requested -- avoids a divide/modulo-by-zero below.
  const sessionsPerWeek = sessions.length === 0 ? 0 : Math.min(Math.max(requestedSessionsPerWeek, 0), days);

  if (sessions.length > 0 && sessionsPerWeek > sessions.length) {
    warnings.push(
      `This phase has ${sessions.length} authored session${sessions.length === 1 ? "" : "s"} but ${sessionsPerWeek} were requested -- repeating sessions to fill the full week rather than leaving extra days as rest.`
    );
  }

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

    // Cycle back through the authored sessions (rather than indexing
    // straight through and running off the end) so a phase with fewer
    // sessions than requested still fills every scheduled day.
    const session = sessions[sessionCursor % sessions.length];
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
