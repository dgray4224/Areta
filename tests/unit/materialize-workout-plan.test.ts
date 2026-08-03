import { describe, expect, it } from "vitest";
import { materializeWorkoutPlan } from "@/domains/workoutplan/generate";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { HydratedProgramPhase, ProgramSessionExercise } from "@/domains/trainingprogram/types";

function exercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "e1",
    name: "Test Exercise",
    movementPattern: "squat",
    equipmentRequired: [],
    archetypeTags: ["powerlifter"],
    difficulty: "beginner",
    primaryMuscleGroups: [],
    instructions: null,
    ...overrides,
  };
}

function prescription(overrides: Partial<ProgramSessionExercise>): ProgramSessionExercise {
  return {
    id: "rx1",
    sessionId: "s1",
    exerciseOrder: 0,
    exerciseId: "e1",
    sets: 3,
    repsMin: 5,
    repsMax: 5,
    intensityType: "rpe",
    intensityValue: "8",
    durationMinutes: null,
    cardioIntensity: null,
    coachingNotes: null,
    primaryExerciseId: null,
    ...overrides,
  };
}

const LIBRARY: Exercise[] = [
  exercise({ id: "barbell-squat", name: "Barbell Squat", movementPattern: "squat", equipmentRequired: ["Barbell", "Full gym access"], archetypeTags: ["powerlifter"], primaryMuscleGroups: ["quads", "glutes"] }),
  exercise({ id: "goblet-squat", name: "Goblet Squat", movementPattern: "squat", equipmentRequired: ["Dumbbells"], archetypeTags: ["powerlifter", "general_fitness"], primaryMuscleGroups: ["quads", "glutes"] }),
  exercise({ id: "leg-press", name: "Leg Press", movementPattern: "squat machine", equipmentRequired: ["Full gym access"], archetypeTags: ["powerlifter"], primaryMuscleGroups: ["quads"] }),
  exercise({ id: "bodyweight-lunge", name: "Reverse Lunge", movementPattern: "single-leg", equipmentRequired: ["Bodyweight only"], archetypeTags: ["powerlifter"], primaryMuscleGroups: ["quads", "glutes"] }),
  exercise({ id: "plank", name: "Plank", movementPattern: "core", equipmentRequired: ["Bodyweight only"], archetypeTags: ["powerlifter"], primaryMuscleGroups: ["core"] }),
];

function hydratedPhase(sessionExerciseIds: string[][]): HydratedProgramPhase {
  return {
    id: "phase1",
    programId: "p1",
    phaseOrder: 1,
    name: "Phase 1",
    focus: "Test focus",
    lengthWeeks: 4,
    intensityStyle: null,
    isFinal: false,
    sessions: sessionExerciseIds.map((exerciseIds, sessionIndex) => ({
      id: `s${sessionIndex}`,
      phaseId: "phase1",
      sessionIndex,
      name: `Session ${sessionIndex}`,
      sessionType: "strength",
      exercises: exerciseIds.map((exerciseId, i) =>
        prescription({ id: `rx-${sessionIndex}-${i}`, sessionId: `s${sessionIndex}`, exerciseId, exerciseOrder: i })
      ),
    })),
  };
}

describe("materializeWorkoutPlan", () => {
  it("uses the prescribed exercise as-is when the user has the required equipment", () => {
    const { days, warnings } = materializeWorkoutPlan({
      phase: hydratedPhase([["barbell-squat"]]),
      archetype: "powerlifter",
      equipmentAccess: ["Full gym access"],
      exercises: LIBRARY,
    });

    const used = days.flatMap((d) => d.exercises);
    expect(used).toHaveLength(1);
    expect(used[0].exerciseId).toBe("barbell-squat");
    expect(used[0].substituted).toBe(false);
    expect(warnings).toHaveLength(0);
  });

  it("substitutes the same movement pattern + archetype when equipment doesn't match", () => {
    // No exercise shares "squat" movement pattern + is equipment-compatible
    // with Dumbbells other than goblet-squat.
    const { days, warnings } = materializeWorkoutPlan({
      phase: hydratedPhase([["barbell-squat"]]),
      archetype: "powerlifter",
      equipmentAccess: ["Dumbbells"],
      exercises: LIBRARY,
    });

    const used = days.flatMap((d) => d.exercises);
    expect(used[0].exerciseId).toBe("goblet-squat");
    expect(used[0].substituted).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("falls back to shared muscle group + archetype when no movement-pattern match is equipment-compatible", () => {
    // Bodyweight only: no "squat" movement pattern is bodyweight-compatible,
    // but Reverse Lunge shares quads/glutes + the powerlifter archetype tag.
    const { days } = materializeWorkoutPlan({
      phase: hydratedPhase([["barbell-squat"]]),
      archetype: "powerlifter",
      equipmentAccess: ["Bodyweight only"],
      exercises: LIBRARY,
    });

    const used = days.flatMap((d) => d.exercises);
    expect(used[0].exerciseId).toBe("bodyweight-lunge");
    expect(used[0].substituted).toBe(true);
  });

  it("keeps the original prescription with a warning when no substitute exists at any tier", () => {
    const narrowLibrary: Exercise[] = [
      exercise({ id: "barbell-squat", name: "Barbell Squat", equipmentRequired: ["Barbell", "Full gym access"], archetypeTags: ["powerlifter"] }),
    ];
    const { days, warnings } = materializeWorkoutPlan({
      phase: hydratedPhase([["barbell-squat"]]),
      archetype: "powerlifter",
      equipmentAccess: ["Bodyweight only"],
      exercises: narrowLibrary,
    });

    const used = days.flatMap((d) => d.exercises);
    expect(used[0].exerciseId).toBe("barbell-squat");
    expect(used[0].substituted).toBe(false);
    expect(warnings.some((w) => w.includes("No equipment-compatible substitute"))).toBe(true);
  });

  it("spreads sessions evenly across the week and marks the rest as rest days", () => {
    const { days } = materializeWorkoutPlan({
      phase: hydratedPhase([["barbell-squat"], ["leg-press"], ["plank"]]),
      archetype: "powerlifter",
      equipmentAccess: ["Full gym access"],
      exercises: LIBRARY,
    });

    expect(days).toHaveLength(7);
    const sessionDays = days.filter((d) => !d.isRestDay);
    expect(sessionDays).toHaveLength(3);
    for (const day of sessionDays) {
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it("carries prescription detail (reps range, intensity, coaching notes) through to the planned exercise", () => {
    const { days } = materializeWorkoutPlan({
      phase: hydratedPhase([["barbell-squat"]]),
      archetype: "powerlifter",
      equipmentAccess: ["Full gym access"],
      exercises: LIBRARY,
    });

    const [item] = days.flatMap((d) => d.exercises);
    expect(item.repsMin).toBe(5);
    expect(item.repsMax).toBe(5);
    expect(item.intensityType).toBe("rpe");
    expect(item.intensityValue).toBe("8");
    expect(item.programSessionExerciseId).toBe("rx-0-0");
  });
});
