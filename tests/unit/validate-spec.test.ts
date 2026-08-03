import { describe, expect, it } from "vitest";
import { crossReferenceBatch } from "@/scripts/training-content/validate-spec";
import type { ContentBatch } from "@/domains/trainingprogram/content-spec";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

/** Minimal fake covering only the query shapes crossReferenceBatch
 * actually issues: a plain select+in on training_programs (slug
 * uniqueness) and a plain select on exercises (name resolution). */
function fakeSupabase(options: { existingSlugs?: string[]; existingExerciseNames?: string[] } = {}) {
  const existingSlugs = options.existingSlugs ?? [];
  const existingExerciseNames = options.existingExerciseNames ?? [];

  return {
    from(table: string) {
      if (table === "training_programs") {
        return {
          select() {
            return {
              in(_col: string, values: string[]) {
                return Promise.resolve({
                  data: existingSlugs.filter((s) => values.includes(s)).map((slug) => ({ slug })),
                  error: null,
                });
              },
            };
          },
        };
      }
      if (table === "exercises") {
        return {
          select() {
            return Promise.resolve({ data: existingExerciseNames.map((name) => ({ name })), error: null });
          },
        };
      }
      throw new Error(`Unexpected table in fakeSupabase: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

function baseBatch(): ContentBatch {
  return {
    newExercises: [],
    programs: [
      {
        archetype: "powerlifter",
        slug: "test-program",
        name: "Test Program",
        sessionsPerWeekMin: 3,
        sessionsPerWeekMax: 4,
        equipmentRequired: [],
        displayOrder: 0,
        phases: [
          {
            name: "Phase 1",
            lengthWeeks: 4,
            isFinal: true,
            sessions: [
              {
                exercises: [
                  {
                    kind: "strength",
                    exerciseRef: "Barbell back squat",
                    sets: 3,
                    repsMin: 5,
                    repsMax: 5,
                    intensityType: "rpe",
                    intensityValue: "7",
                  },
                ],
              },
            ],
          },
        ],
        sources: [{ organization: "NSCA", title: "Test", url: "https://nsca.com/x", retrievedAt: "2026-08-03" }],
      },
    ],
  };
}

describe("crossReferenceBatch: alternates", () => {
  it("passes when an alternate resolves to an existing exercise", async () => {
    const batch = baseBatch();
    batch.programs[0].phases[0].sessions[0].exercises[0].alternates = [
      { kind: "cardio", exerciseRef: "Steady-state swim", durationMinutes: 20, cardioIntensity: "easy" },
    ];
    const result = await crossReferenceBatch(
      batch,
      fakeSupabase({ existingExerciseNames: ["Barbell back squat", "Steady-state swim"] })
    );
    expect(result.ok).toBe(true);
  });

  it("fails when an alternate's exerciseRef doesn't resolve", async () => {
    const batch = baseBatch();
    batch.programs[0].phases[0].sessions[0].exercises[0].alternates = [
      { kind: "cardio", exerciseRef: "Nonexistent Exercise", durationMinutes: 20, cardioIntensity: "easy" },
    ];
    const result = await crossReferenceBatch(batch, fakeSupabase({ existingExerciseNames: ["Barbell back squat"] }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Nonexistent Exercise"))).toBe(true);
  });

  it("flags a no-op alternate (same exerciseRef as its primary)", async () => {
    const batch = baseBatch();
    batch.programs[0].phases[0].sessions[0].exercises[0].alternates = [
      { kind: "strength", exerciseRef: "Barbell back squat", sets: 3, repsMin: 5, repsMax: 5, intensityType: "rpe" },
    ];
    const result = await crossReferenceBatch(batch, fakeSupabase({ existingExerciseNames: ["Barbell back squat"] }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("no-op alternate"))).toBe(true);
  });

  it("flags duplicate exerciseRefs within one alternates array", async () => {
    const batch = baseBatch();
    batch.programs[0].phases[0].sessions[0].exercises[0].alternates = [
      { kind: "cardio", exerciseRef: "Steady-state swim", durationMinutes: 20, cardioIntensity: "easy" },
      { kind: "cardio", exerciseRef: "Steady-state swim", durationMinutes: 25, cardioIntensity: "easy" },
    ];
    const result = await crossReferenceBatch(
      batch,
      fakeSupabase({ existingExerciseNames: ["Barbell back squat", "Steady-state swim"] })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicate alternate exerciseRef"))).toBe(true);
  });

  it("resolves an alternate against a newExercises refKey", async () => {
    const batch = baseBatch();
    batch.newExercises = [
      {
        refKey: "new-alt",
        name: "Some New Movement",
        movementPattern: "hinge",
        equipmentRequired: [],
        archetypeTags: ["powerlifter"],
        difficulty: "intermediate",
        primaryMuscleGroups: [],
      },
    ];
    batch.programs[0].phases[0].sessions[0].exercises[0].alternates = [
      { kind: "strength", exerciseRef: "new-alt", sets: 3, repsMin: 8, repsMax: 8, intensityType: "rpe" },
    ];
    const result = await crossReferenceBatch(batch, fakeSupabase({ existingExerciseNames: ["Barbell back squat"] }));
    expect(result.ok).toBe(true);
  });
});
