import { describe, expect, it } from "vitest";
import { generateWorkoutPlan } from "@/domains/workoutplan/generate";
import type { Exercise } from "@/domains/exerciselibrary/types";

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
    expect(warnings).toHaveLength(0);
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
});
