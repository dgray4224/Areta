import { describe, expect, it } from "vitest";
import { classifyWeeklyTrainingFocus } from "@/domains/workoutplan/training-focus";
import type { WorkoutPlanItemView } from "@/domains/workoutplan/service";
import type { Exercise } from "@/domains/exerciselibrary/types";

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: `Exercise ${id}`,
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

function item(overrides: Partial<WorkoutPlanItemView>): WorkoutPlanItemView {
  return {
    id: "i1",
    dayOfWeek: 0,
    sessionOrder: 0,
    exerciseId: "e1",
    sets: null,
    reps: null,
    durationMinutes: null,
    completedAt: null,
    scheduledTime: null,
    notes: null,
    repsMin: null,
    repsMax: null,
    intensityType: null,
    intensityValue: null,
    cardioIntensity: null,
    coachingNotes: null,
    substituted: false,
    programSessionExerciseId: null,
    ...overrides,
  };
}

describe("classifyWeeklyTrainingFocus", () => {
  it("returns a null label with zero minutes when there are no items", () => {
    const result = classifyWeeklyTrainingFocus([], new Map());
    expect(result.label).toBeNull();
    expect(result.resistanceMinutes + result.aerobicMinutes + result.mobilityMinutes).toBe(0);
  });

  it("classifies a week dominated by resistance sets as heavy lifting", () => {
    const exercises = new Map([
      ["squat", exercise("squat", { modality: "resistance" })],
      ["bench", exercise("bench", { modality: "resistance" })],
    ]);
    const items = [
      item({ exerciseId: "squat", sets: 5 }),
      item({ exerciseId: "bench", sets: 5 }),
    ];
    const result = classifyWeeklyTrainingFocus(items, exercises);
    expect(result.label).toBe("Heavy lifting week");
    expect(result.resistanceMinutes).toBeGreaterThan(result.aerobicMinutes);
  });

  it("classifies a week dominated by aerobic duration as heavy cardio", () => {
    const exercises = new Map([["run", exercise("run", { modality: "aerobic" })]]);
    const items = [
      item({ exerciseId: "run", durationMinutes: 45 }),
      item({ exerciseId: "run", durationMinutes: 45 }),
    ];
    const result = classifyWeeklyTrainingFocus(items, exercises);
    expect(result.label).toBe("Heavy cardio week");
  });

  it("classifies a week dominated by mobility work as recovery", () => {
    const exercises = new Map([["stretch", exercise("stretch", { modality: "mobility" })]]);
    const items = [
      item({ exerciseId: "stretch", durationMinutes: 30 }),
      item({ exerciseId: "stretch", durationMinutes: 30 }),
    ];
    const result = classifyWeeklyTrainingFocus(items, exercises);
    expect(result.label).toBe("Recovery week");
  });

  it("classifies a roughly even resistance/aerobic mix as balanced", () => {
    const exercises = new Map([
      ["squat", exercise("squat", { modality: "resistance" })],
      ["run", exercise("run", { modality: "aerobic" })],
    ]);
    const items = [item({ exerciseId: "squat", sets: 10 }), item({ exerciseId: "run", durationMinutes: 20 })];
    const result = classifyWeeklyTrainingFocus(items, exercises);
    expect(result.label).toBe("Balanced week");
  });

  it("counts items with no modality as unclassified instead of guessing", () => {
    const exercises = new Map([["legacy", exercise("legacy", { modality: null })]]);
    const items = [item({ exerciseId: "legacy", sets: 5 })];
    const result = classifyWeeklyTrainingFocus(items, exercises);
    expect(result.unclassifiedCount).toBe(1);
    expect(result.label).toBeNull();
  });

  it("counts items for an exercise missing from the map as unclassified", () => {
    const items = [item({ exerciseId: "missing", sets: 5 })];
    const result = classifyWeeklyTrainingFocus(items, new Map());
    expect(result.unclassifiedCount).toBe(1);
  });
});
