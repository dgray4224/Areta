import { beforeEach, describe, expect, it } from "vitest";

import type { ExerciseInput } from "@/domains/exercise/schema";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { LimitationRule } from "@/domains/recommendation/types";
import {
  generateTodayWorkouts,
  TODAY_FOCUSES,
  type GenerateTodayInput,
  type TodayFocus,
} from "@/domains/workoutplan/generate-today";

let counter = 0;
beforeEach(() => {
  counter = 0;
});

function exercise(overrides: Partial<Exercise>): Exercise {
  counter++;
  return {
    id: `e${counter}`,
    name: `Exercise ${counter}`,
    movementPattern: "squat",
    equipmentRequired: ["Bodyweight only"],
    archetypeTags: [],
    difficulty: "beginner",
    primaryMuscleGroups: ["quads"],
    instructions: null,
    movementPatterns: ["squat"],
    modality: "resistance",
    limitationTags: [],
    compound: true,
    ...overrides,
  };
}

/** A library wide enough that the generator is never forced to relax
 * anything, so a test that sees a relaxation is seeing a real one. */
function wideLibrary(): Exercise[] {
  const groups = [
    "chest", "back", "shoulders", "arms", "biceps", "triceps",
    "quads", "hamstrings", "glutes", "calves", "legs", "core",
  ];
  const rows: Exercise[] = [];
  for (const group of groups) {
    // Six per group: more than the longest variant asks for, so a short
    // session in a test is the generator's choice, not the fixture's limit.
    for (let i = 0; i < 6; i++) {
      rows.push(
        exercise({
          // Ids encode the muscle group so assertions can check what a
          // session actually targeted, and stay stable across calls --
          // the determinism test depends on that.
          id: `${group}-${i}`,
          primaryMuscleGroups: [group],
          name: `${group} ${i}`,
          compound: i % 2 === 0,
        })
      );
    }
  }
  for (let i = 0; i < 5; i++) {
    rows.push(
      exercise({
        id: `cardio-${i}`,
        primaryMuscleGroups: ["cardio"],
        name: `cardio ${i}`,
        modality: "aerobic",
        movementPatterns: ["run"],
        compound: false,
      })
    );
  }
  return rows;
}

/** The muscle group an id from wideLibrary() belongs to. */
function groupOf(exerciseId: string): string | null {
  const match = /^(.+)-\d+$/.exec(exerciseId);
  return match ? match[1] : null;
}

function input(overrides: Partial<GenerateTodayInput> = {}): GenerateTodayInput {
  return {
    userId: "user-1",
    focus: "upper_body",
    tier: "intermediate",
    exercises: wideLibrary(),
    exercise: { equipmentAccess: ["Bodyweight only"] } as ExerciseInput,
    limitationRules: [],
    recentUseCounts: new Map(),
    ...overrides,
  };
}

describe("generateTodayWorkouts", () => {
  it("offers three options for every focus", () => {
    for (const focus of TODAY_FOCUSES) {
      const result = generateTodayWorkouts(input({ focus }));
      expect(result.options, `focus ${focus}`).toHaveLength(3);
      for (const option of result.options) {
        expect(option.exercises.length, `${focus}/${option.key}`).toBeGreaterThan(0);
        expect(option.name).toContain(" ");
      }
    }
  });

  it("gives the three options different content, not three shuffles of one", () => {
    const result = generateTodayWorkouts(input({ focus: "full_body" }));
    const [a, b] = result.options.map((o) => new Set(o.exercises.map((e) => e.exerciseId)));
    const shared = [...a].filter((id) => b.has(id));
    // Some overlap is fine and often correct; being the same workout is not.
    expect(shared.length).toBeLessThan(Math.min(a.size, b.size));
  });

  it("gives the options genuinely different shapes", () => {
    const result = generateTodayWorkouts(input({ focus: "lower_body" }));
    const counts = result.options.map((o) => o.exercises.length);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it("keeps an upper-body session on upper-body muscles", () => {
    const result = generateTodayWorkouts(input({ focus: "upper_body" }));
    const upper = new Set(["chest", "back", "shoulders", "arms", "biceps", "triceps", "grip", "core"]);
    const seen: string[] = [];
    for (const option of result.options) {
      for (const ex of option.exercises) {
        const group = groupOf(ex.exerciseId);
        expect(group, ex.exerciseId).not.toBeNull();
        expect(upper.has(group!), `${ex.exerciseId} is not upper body`).toBe(true);
        seen.push(group!);
      }
    }
    // And it walked the region rather than parking on one muscle.
    expect(new Set(seen).size).toBeGreaterThan(2);
  });

  it("keeps a lower-body session off the upper body", () => {
    const result = generateTodayWorkouts(input({ focus: "lower_body" }));
    const lower = new Set(["quads", "hamstrings", "glutes", "calves", "legs", "core"]);
    for (const option of result.options) {
      for (const ex of option.exercises) {
        expect(lower.has(groupOf(ex.exerciseId)!), `${ex.exerciseId} is not lower body`).toBe(true);
      }
    }
  });

  // --- the safety floor ---------------------------------------------

  it("never offers an exercise tagged with the user's limitation", () => {
    const library = [
      ...wideLibrary(),
      exercise({ id: "bad-knee", primaryMuscleGroups: ["quads"], limitationTags: ["knee"] }),
    ];
    const result = generateTodayWorkouts(
      input({
        focus: "lower_body",
        exercises: library,
        exercise: {
          equipmentAccess: ["Bodyweight only"],
          injuryStatus: "yes",
          limitationTags: ["knee"],
        } as ExerciseInput,
      })
    );
    const offered = result.options.flatMap((o) => o.exercises.map((e) => e.exerciseId));
    expect(offered).not.toContain("bad-knee");
    expect(offered.length).toBeGreaterThan(0);
  });

  it("never offers a movement pattern an approved rule excludes", () => {
    const library = [
      ...wideLibrary(),
      exercise({
        id: "hinge-1",
        primaryMuscleGroups: ["hamstrings"],
        movementPatterns: ["hinge"],
      }),
    ];
    const rules: LimitationRule[] = [
      {
        limitationTag: "lower_back",
        action: "exclude",
        movementPattern: "hinge",
        substituteMovementPattern: null,
        rationale: "Loaded hinging aggravates the lower back.",
      },
    ];
    const result = generateTodayWorkouts(
      input({
        focus: "lower_body",
        exercises: library,
        limitationRules: rules,
        exercise: {
          equipmentAccess: ["Bodyweight only"],
          injuryStatus: "yes",
          limitationTags: ["lower_back"],
        } as ExerciseInput,
      })
    );
    const offered = result.options.flatMap((o) => o.exercises.map((e) => e.exerciseId));
    expect(offered).not.toContain("hinge-1");
  });

  it("never offers an advanced movement to a beginner", () => {
    const library = [
      ...wideLibrary(),
      exercise({ id: "muscle-up", primaryMuscleGroups: ["back"], difficulty: "advanced" }),
    ];
    const result = generateTodayWorkouts(input({ focus: "upper_body", tier: "beginner", exercises: library }));
    const offered = result.options.flatMap((o) => o.exercises.map((e) => e.exerciseId));
    expect(offered).not.toContain("muscle-up");
  });

  it("keeps the safety floor even when it has to widen equipment", () => {
    // Only one on-focus exercise exists, it needs a barbell, and the
    // user has none. Widening equipment is allowed; ignoring the injury
    // tag is not, so the result must be empty rather than unsafe.
    const library = [
      exercise({ id: "barbell-row", primaryMuscleGroups: ["back"], equipmentRequired: ["Barbell"], limitationTags: ["shoulder"] }),
    ];
    const result = generateTodayWorkouts(
      input({
        focus: "upper_body",
        exercises: library,
        exercise: {
          equipmentAccess: ["Bodyweight only"],
          injuryStatus: "yes",
          limitationTags: ["shoulder"],
        } as ExerciseInput,
      })
    );
    expect(result.options.flatMap((o) => o.exercises)).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/limitations/i);
  });

  it("surfaces a manual-review rule as a warning rather than silently proceeding", () => {
    const rules: LimitationRule[] = [
      {
        limitationTag: "cardiovascular",
        action: "manual_review",
        movementPattern: null,
        substituteMovementPattern: null,
        rationale: "Check with your clinician before high-intensity work.",
      },
    ];
    const result = generateTodayWorkouts(
      input({
        limitationRules: rules,
        exercise: {
          equipmentAccess: ["Bodyweight only"],
          injuryStatus: "yes",
          limitationTags: ["cardiovascular"],
        } as ExerciseInput,
      })
    );
    expect(result.warnings.join(" ")).toContain("clinician");
  });

  // --- equipment and prescription ------------------------------------

  it("prefers exercises the user can actually do, and says so when it can't", () => {
    const library = [
      exercise({ id: "bench", primaryMuscleGroups: ["chest"], equipmentRequired: ["Barbell"] }),
      exercise({ id: "row", primaryMuscleGroups: ["back"], equipmentRequired: ["Barbell"] }),
    ];
    const result = generateTodayWorkouts(
      input({ focus: "upper_body", exercises: library, exercise: { equipmentAccess: ["Bodyweight only"] } as ExerciseInput })
    );
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0].warnings.join(" ")).toMatch(/equipment/i);
  });

  it("prescribes sets and reps for resistance work and minutes for cardio", () => {
    const resistance = generateTodayWorkouts(input({ focus: "upper_body" }));
    for (const ex of resistance.options[0].exercises) {
      expect(ex.sets).toBeGreaterThan(0);
      expect(ex.reps).toBeGreaterThan(0);
      expect(ex.durationMinutes).toBeNull();
    }

    const cardio = generateTodayWorkouts(input({ focus: "cardio" }));
    for (const ex of cardio.options[0].exercises) {
      expect(ex.durationMinutes).toBeGreaterThan(0);
      expect(ex.sets).toBeNull();
    }
  });

  it("estimates a plausible length for every option", () => {
    for (const focus of TODAY_FOCUSES) {
      for (const option of generateTodayWorkouts(input({ focus })).options) {
        expect(option.estimatedMinutes, `${focus}/${option.key}`).toBeGreaterThan(0);
        expect(option.estimatedMinutes).toBeLessThan(180);
      }
    }
  });

  it("returns the same three options when the user backs out and asks again", () => {
    const first = generateTodayWorkouts(input({ focus: "full_body" }));
    const second = generateTodayWorkouts(input({ focus: "full_body" }));
    expect(second.options.map((o) => o.exercises.map((e) => e.exerciseId))).toEqual(
      first.options.map((o) => o.exercises.map((e) => e.exerciseId))
    );
  });

  it("steers away from what the user has been doing lately", () => {
    const library = wideLibrary();
    const chestOnes = library.filter((e) => e.primaryMuscleGroups.includes("chest"));
    const overused = new Map(chestOnes.slice(0, 2).map((e) => [e.id, 6]));

    const fresh = generateTodayWorkouts(input({ focus: "upper_body", exercises: library }));
    const steered = generateTodayWorkouts(
      input({ focus: "upper_body", exercises: library, recentUseCounts: overused })
    );

    const inFresh = fresh.options.flatMap((o) => o.exercises.map((e) => e.exerciseId));
    const inSteered = steered.options.flatMap((o) => o.exercises.map((e) => e.exerciseId));
    const overusedIds = [...overused.keys()];
    const before = inFresh.filter((id) => overusedIds.includes(id)).length;
    const after = inSteered.filter((id) => overusedIds.includes(id)).length;
    expect(after).toBeLessThanOrEqual(before);
  });

  it("reports honestly when the library has nothing for the focus", () => {
    const result = generateTodayWorkouts(
      input({ focus: "cardio", exercises: [exercise({ primaryMuscleGroups: ["chest"], modality: "resistance" })] })
    );
    expect(result.options).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("does not repeat an exercise within one option", () => {
    for (const focus of TODAY_FOCUSES) {
      for (const option of generateTodayWorkouts(input({ focus })).options) {
        const ids = option.exercises.map((e) => e.exerciseId);
        expect(new Set(ids).size, `${focus}/${option.key}`).toBe(ids.length);
      }
    }
  });
});

// Focus keys are part of the client contract; a rename is a breaking change.
describe("TODAY_FOCUSES", () => {
  it("is the set the client renders", () => {
    expect([...TODAY_FOCUSES]).toEqual<TodayFocus[]>([
      "full_body",
      "upper_body",
      "lower_body",
      "core",
      "cardio",
    ]);
  });
});
