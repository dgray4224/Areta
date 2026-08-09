import { describe, expect, it } from "vitest";
import { generateWorkoutPlan, materializeWorkoutPlan } from "@/domains/workoutplan/generate";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { HydratedProgramPhase } from "@/domains/trainingprogram/types";

function exercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "e1",
    name: "Test Exercise",
    movementPattern: "squat",
    equipmentRequired: [],
    archetypeTags: ["general_fitness"],
    difficulty: "beginner",
    primaryMuscleGroups: [],
    instructions: null,
    movementPatterns: [],
    modality: null,
    limitationTags: [],
    compound: false,
    ...overrides,
  };
}

const SAMPLE_EXERCISES: Exercise[] = [
  exercise({ id: "bw1", name: "Push-up", equipmentRequired: ["Bodyweight only"], archetypeTags: ["general_fitness", "hybrid_athlete"] }),
  exercise({ id: "bw2", name: "Squat", equipmentRequired: ["Bodyweight only"], archetypeTags: ["general_fitness", "hybrid_athlete"] }),
  exercise({ id: "bw3", name: "Plank", equipmentRequired: ["Bodyweight only"], archetypeTags: ["general_fitness"] }),
  exercise({ id: "db1", name: "DB Row", equipmentRequired: ["Dumbbells"], archetypeTags: ["hypertrophy", "general_fitness"] }),
  exercise({ id: "db2", name: "DB Press", equipmentRequired: ["Dumbbells"], archetypeTags: ["hypertrophy", "general_fitness"] }),
  exercise({ id: "bb1", name: "Barbell Squat", equipmentRequired: ["Barbell", "Full gym access"], archetypeTags: ["powerlifter"] }),
  exercise({ id: "run1", name: "Easy run", movementPattern: "aerobic", equipmentRequired: ["Cardio machine"], archetypeTags: ["long_distance_runner"] }),
];

describe("generateWorkoutPlan", () => {
  it("fills the requested number of session days, leaving the rest as rest days", () => {
    const { days } = generateWorkoutPlan({
      sessionsPerWeek: 3,
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only", "Dumbbells"],
      exercises: SAMPLE_EXERCISES,
    });

    expect(days).toHaveLength(7);
    const sessionDays = days.filter((d) => !d.isRestDay);
    expect(sessionDays).toHaveLength(3);
    for (const day of sessionDays) {
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it("never includes an exercise requiring equipment the user doesn't have", () => {
    const { days } = generateWorkoutPlan({
      sessionsPerWeek: 4,
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only"],
      exercises: SAMPLE_EXERCISES,
    });

    const usedIds = new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
    expect(usedIds.has("db1")).toBe(false);
    expect(usedIds.has("db2")).toBe(false);
    expect(usedIds.has("bb1")).toBe(false);
  });

  it("'Full gym access' satisfies any specific equipment requirement", () => {
    const { days, warnings } = generateWorkoutPlan({
      sessionsPerWeek: 3,
      archetype: "powerlifter",
      equipmentAccess: ["Full gym access"],
      exercises: SAMPLE_EXERCISES,
    });

    const usedIds = new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
    expect(usedIds.has("bb1")).toBe(true);
    // SAMPLE_EXERCISES only has one "powerlifter" exercise (bb1), so this
    // legitimately warns about a narrow pool -- see the next test for the
    // behavior that warning is describing.
    expect(warnings).toHaveLength(1);
  });

  it("repeats exercises rather than truncating a session when the eligible pool is smaller than exercisesPerSession", () => {
    const { days, warnings } = generateWorkoutPlan({
      sessionsPerWeek: 1,
      archetype: "powerlifter",
      equipmentAccess: ["Full gym access"],
      exercises: SAMPLE_EXERCISES,
      exercisesPerSession: 5,
    });

    const sessionDay = days.find((d) => !d.isRestDay);
    expect(sessionDay).toBeDefined();
    // Only one eligible exercise (bb1) exists for "powerlifter" -- a full
    // 5-slot session must still be filled by repeating it, not truncated
    // to 1 exercise (the bug this test guards against).
    expect(sessionDay?.exercises).toHaveLength(5);
    expect(sessionDay?.exercises.every((e) => e.exerciseId === "bb1")).toBe(true);
    expect(warnings.some((w) => w.includes("Only 1 exercise"))).toBe(true);
  });

  it("falls back with a warning when no exercise matches archetype and equipment", () => {
    const { warnings } = generateWorkoutPlan({
      sessionsPerWeek: 2,
      archetype: "powerlifter",
      equipmentAccess: ["Bodyweight only"],
      exercises: SAMPLE_EXERCISES,
    });

    expect(warnings.length).toBeGreaterThan(0);
  });

  it("caps any single exercise at 2 uses per week when alternatives exist", () => {
    const { days } = generateWorkoutPlan({
      sessionsPerWeek: 4,
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only", "Dumbbells"],
      exercises: SAMPLE_EXERCISES,
      exercisesPerSession: 2,
    });

    const usage = new Map<string, number>();
    for (const day of days) {
      for (const ex of day.exercises) {
        usage.set(ex.exerciseId, (usage.get(ex.exerciseId) ?? 0) + 1);
      }
    }
    for (const count of usage.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it("assigns duration instead of sets/reps for cardio-pattern exercises", () => {
    const { days } = generateWorkoutPlan({
      sessionsPerWeek: 3,
      archetype: "long_distance_runner",
      equipmentAccess: ["Cardio machine"],
      exercises: SAMPLE_EXERCISES,
    });

    const runEntry = days.flatMap((d) => d.exercises).find((e) => e.exerciseId === "run1");
    expect(runEntry?.durationMinutes).toBeGreaterThan(0);
    expect(runEntry?.sets).toBeNull();
  });

  describe("pickWeights (frequency-weighting)", () => {
    // Both general_fitness/bodyweight, so both are eligible together --
    // input order (bw1 before bw2) is what round-robin selection falls
    // back to with no history.
    const TWO_EXERCISES = SAMPLE_EXERCISES.filter((e) => e.id === "bw1" || e.id === "bw2");

    it("reorders the eligible pool so a higher pick count is chosen first", () => {
      const withoutHistory = generateWorkoutPlan({
        sessionsPerWeek: 1,
        archetype: "general_fitness",
        equipmentAccess: ["Bodyweight only"],
        exercises: TWO_EXERCISES,
        exercisesPerSession: 1,
      });
      const sessionDay = withoutHistory.days.find((d) => !d.isRestDay);
      expect(sessionDay?.exercises[0].exerciseId).toBe("bw1"); // input-order fallback, no history

      const withHistory = generateWorkoutPlan({
        sessionsPerWeek: 1,
        archetype: "general_fitness",
        equipmentAccess: ["Bodyweight only"],
        exercises: TWO_EXERCISES,
        exercisesPerSession: 1,
        pickWeights: new Map([["bw2", 5]]),
      });
      const historySessionDay = withHistory.days.find((d) => !d.isRestDay);
      expect(historySessionDay?.exercises[0].exerciseId).toBe("bw2"); // reordered ahead of bw1
    });

    it("does not let a high pick count bypass the MAX_USES_PER_WEEK cap", () => {
      const { days } = generateWorkoutPlan({
        sessionsPerWeek: 4,
        archetype: "general_fitness",
        equipmentAccess: ["Bodyweight only"],
        exercises: TWO_EXERCISES,
        exercisesPerSession: 1,
        pickWeights: new Map([["bw2", 100]]), // huge bonus -- would win every session if caps didn't apply
      });

      const usage = new Map<string, number>();
      for (const day of days) {
        for (const ex of day.exercises) usage.set(ex.exerciseId, (usage.get(ex.exerciseId) ?? 0) + 1);
      }
      expect(usage.get("bw2")).toBeLessThanOrEqual(2); // still capped
      expect(usage.get("bw1")).toBeGreaterThan(0); // had to fall back once bw2 hit its cap
    });

    it("produces identical output whether pickWeights is omitted or an empty Map", () => {
      const base = { sessionsPerWeek: 3, archetype: "general_fitness", equipmentAccess: ["Bodyweight only", "Dumbbells"], exercises: SAMPLE_EXERCISES };
      const omitted = generateWorkoutPlan(base);
      const empty = generateWorkoutPlan({ ...base, pickWeights: new Map() });
      expect(empty).toEqual(omitted);
    });
  });
});

function hydratedPhase(sessionCount: number): HydratedProgramPhase {
  return {
    id: "phase1",
    programId: "program1",
    phaseOrder: 1,
    name: "Test Phase",
    focus: null,
    lengthWeeks: 4,
    intensityStyle: null,
    isFinal: false,
    sessions: Array.from({ length: sessionCount }, (_, i) => ({
      id: `session${i}`,
      phaseId: "phase1",
      sessionIndex: i + 1,
      name: `Session ${i + 1}`,
      sessionType: "strength",
      exercises: [
        {
          id: `rx${i}`,
          sessionId: `session${i}`,
          exerciseOrder: 1,
          exerciseId: "bw1",
          sets: 3,
          repsMin: 10,
          repsMax: 12,
          intensityType: "none" as const,
          intensityValue: null,
          durationMinutes: null,
          cardioIntensity: null,
          coachingNotes: null,
          primaryExerciseId: null,
        },
      ],
    })),
  };
}

describe("materializeWorkoutPlan", () => {
  it("cycles through authored sessions to fill a requested week that has more sessions than are authored", () => {
    // 3 sessions authored, but the user asked for 5/week -- previously
    // this silently produced only 3 training days with the rest as
    // unexplained rest days (the bug this test guards against).
    const { days, warnings } = materializeWorkoutPlan({
      phase: hydratedPhase(3),
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only"],
      exercises: SAMPLE_EXERCISES,
      sessionsPerWeek: 5,
    });

    const sessionDays = days.filter((d) => !d.isRestDay);
    expect(sessionDays).toHaveLength(5);
    for (const day of sessionDays) {
      expect(day.exercises.length).toBeGreaterThan(0);
    }
    expect(warnings.some((w) => w.includes("repeating sessions"))).toBe(true);
  });

  it("only schedules the requested count when more sessions are authored than requested", () => {
    const { days } = materializeWorkoutPlan({
      phase: hydratedPhase(6),
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only"],
      exercises: SAMPLE_EXERCISES,
      sessionsPerWeek: 3,
    });

    expect(days.filter((d) => !d.isRestDay)).toHaveLength(3);
  });

  it("falls back to the authored session count when sessionsPerWeek is omitted (backward compatible)", () => {
    const { days, warnings } = materializeWorkoutPlan({
      phase: hydratedPhase(4),
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only"],
      exercises: SAMPLE_EXERCISES,
    });

    expect(days.filter((d) => !d.isRestDay)).toHaveLength(4);
    expect(warnings).toHaveLength(0);
  });

  it("schedules zero training days for a phase with no authored sessions, regardless of what was requested", () => {
    const { days } = materializeWorkoutPlan({
      phase: hydratedPhase(0),
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only"],
      exercises: SAMPLE_EXERCISES,
      sessionsPerWeek: 5,
    });

    expect(days.every((d) => d.isRestDay)).toBe(true);
  });
});
