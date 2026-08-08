import { describe, expect, it } from "vitest";
import { fillSessionSlots, type FillSlotsInput } from "@/domains/recommendation/fill-slots";
import type { TemplateSlot, LimitationRule } from "@/domains/recommendation/types";
import type { Exercise } from "@/domains/exerciselibrary/types";

let counter = 0;
function exercise(overrides: Partial<Exercise>): Exercise {
  counter++;
  return {
    id: `e${counter}`,
    name: `Exercise ${counter}`,
    movementPattern: "squat",
    equipmentRequired: ["Bodyweight only"],
    archetypeTags: [],
    difficulty: "intermediate",
    primaryMuscleGroups: [],
    instructions: null,
    movementPatterns: ["squat"],
    modality: "resistance",
    limitationTags: [],
    compound: true,
    ...overrides,
  };
}

function slot(overrides: Partial<TemplateSlot>): TemplateSlot {
  counter++;
  return {
    id: `s${counter}`,
    sessionId: "sess1",
    slotOrder: 1,
    slotLabel: "Squat pattern",
    movementPattern: "squat",
    modality: "resistance",
    setsMin: 3,
    setsMax: 5,
    repsMin: 8,
    repsMax: 12,
    effortTarget: "RPE 7-8",
    restSeconds: 90,
    durationMinutesMin: null,
    durationMinutesMax: null,
    coachingNotes: null,
    ...overrides,
  };
}

function input(overrides: Partial<FillSlotsInput>): FillSlotsInput {
  return {
    userId: "u1",
    tier: "intermediate",
    slots: [],
    exercises: [],
    exercise: { equipmentAccess: ["Bodyweight only"] },
    limitationRules: [],
    recentUseCounts: new Map(),
    claimIdsByTopicGroup: { resistance: ["claim-r"], aerobic: ["claim-a"] },
    ...overrides,
  };
}

const LOWER_BACK_EXCLUDE: LimitationRule = {
  limitationTag: "lower_back",
  action: "exclude",
  movementPattern: "olympic_lift",
  substituteMovementPattern: null,
  rationale: "spinal loading under speed",
};

const LOWER_BACK_SUBSTITUTE: LimitationRule = {
  limitationTag: "lower_back",
  action: "substitute",
  movementPattern: "hinge",
  substituteMovementPattern: "hip_extension",
  rationale: "hip extension spares the spine",
};

describe("fillSessionSlots", () => {
  it("fills a slot with a pattern-matching, equipment-compatible exercise", () => {
    const squat = exercise({ movementPatterns: ["squat"] });
    const press = exercise({ movementPatterns: ["horizontal_push"] });
    const result = fillSessionSlots(input({ slots: [slot({})], exercises: [press, squat] }));
    expect(result.filled).toHaveLength(1);
    expect(result.filled[0].exerciseId).toBe(squat.id);
    expect(result.filled[0].provenance.claimIds).toEqual(["claim-r"]);
  });

  it("hard-excludes exercises tagged with the user's limitation — never relaxed", () => {
    const tagged = exercise({ movementPatterns: ["squat"], limitationTags: ["knee"] });
    const safe = exercise({ movementPatterns: ["hip_extension"] });
    const result = fillSessionSlots(
      input({
        slots: [slot({})],
        exercises: [tagged, safe],
        exercise: { equipmentAccess: ["Bodyweight only"], injuryStatus: "yes", limitationTags: ["knee"] },
      })
    );
    expect(result.filled[0]?.exerciseId).toBe(safe.id);
  });

  it("re-targets a slot's pattern via substitute rules (hinge -> hip_extension)", () => {
    const deadlift = exercise({ movementPatterns: ["hinge"] });
    const bridge = exercise({ movementPatterns: ["hip_extension"] });
    const result = fillSessionSlots(
      input({
        slots: [slot({ movementPattern: "hinge", slotLabel: "Hinge pattern" })],
        exercises: [deadlift, bridge],
        limitationRules: [LOWER_BACK_SUBSTITUTE],
        exercise: { equipmentAccess: ["Bodyweight only"], injuryStatus: "yes", limitationTags: ["lower_back"] },
      })
    );
    expect(result.filled[0].exerciseId).toBe(bridge.id);
    expect(result.filled[0].provenance.relaxations.some((r) => r.includes("substituted"))).toBe(true);
  });

  it("excludes pattern-rule patterns for the user's limitation", () => {
    const oly = exercise({ movementPatterns: ["olympic_lift", "hinge"] });
    const rdl = exercise({ movementPatterns: ["hinge"] });
    const result = fillSessionSlots(
      input({
        slots: [slot({ movementPattern: "hinge" })],
        exercises: [oly, rdl],
        limitationRules: [LOWER_BACK_EXCLUDE],
        exercise: { equipmentAccess: ["Bodyweight only"], injuryStatus: "yes", limitationTags: ["lower_back"] },
      })
    );
    expect(result.filled[0].exerciseId).toBe(rdl.id);
  });

  it("never hands an advanced-difficulty exercise to a beginner", () => {
    const advanced = exercise({ movementPatterns: ["squat"], difficulty: "advanced" });
    const beginner = exercise({ movementPatterns: ["squat"], difficulty: "beginner" });
    const result = fillSessionSlots(input({ tier: "beginner", slots: [slot({})], exercises: [advanced, beginner] }));
    expect(result.filled[0].exerciseId).toBe(beginner.id);
  });

  it("relaxes equipment with a warning rather than leaving a slot empty", () => {
    const barbell = exercise({ movementPatterns: ["squat"], equipmentRequired: ["Barbell"] });
    const result = fillSessionSlots(input({ slots: [slot({})], exercises: [barbell] }));
    expect(result.filled).toHaveLength(1);
    expect(result.filled[0].provenance.relaxations.some((r) => r.includes("equipment"))).toBe(true);
  });

  it("skips the slot with a warning when no safe exercise exists at all", () => {
    const tagged = exercise({ movementPatterns: ["squat"], limitationTags: ["knee"] });
    const result = fillSessionSlots(
      input({
        slots: [slot({})],
        exercises: [tagged],
        exercise: { equipmentAccess: ["Bodyweight only"], injuryStatus: "yes", limitationTags: ["knee"] },
      })
    );
    expect(result.filled).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("skipped"))).toBe(true);
  });

  it("fills aerobic slots from the interchangeable aerobic group by stated preference", () => {
    const run = exercise({ movementPatterns: ["run"], modality: "aerobic" });
    const bike = exercise({ movementPatterns: ["bike"], modality: "aerobic" });
    const result = fillSessionSlots(
      input({
        slots: [slot({ movementPattern: "run", modality: "aerobic", slotLabel: "Easy aerobic" })],
        exercises: [run, bike],
        exercise: { equipmentAccess: ["Bodyweight only", "Cardio machine"], preferredActivities: ["cycling"] },
      })
    );
    // Preference (+30) loses to pattern-exact (+50): run still wins;
    // an explicit endurance-activity preference (+50) flips it.
    expect(result.filled[0].exerciseId).toBe(run.id);

    const withEndurancePref = fillSessionSlots(
      input({
        slots: [slot({ movementPattern: "run", modality: "aerobic", slotLabel: "Easy aerobic" })],
        exercises: [run, bike],
        exercise: {
          equipmentAccess: ["Bodyweight only", "Cardio machine"],
          preferredActivities: ["cycling"],
          goalDetail: { preferredEnduranceActivity: "cycling" },
        },
      })
    );
    expect(withEndurancePref.filled[0].exerciseId).toBe(bike.id);
  });

  it("surfaces manual_review limitation rules as plan warnings", () => {
    const rule: LimitationRule = {
      limitationTag: "cardiovascular",
      action: "manual_review",
      movementPattern: null,
      substituteMovementPattern: null,
      rationale: "A stated cardiovascular condition warrants clinician sign-off.",
    };
    const result = fillSessionSlots(
      input({
        slots: [slot({})],
        exercises: [exercise({})],
        limitationRules: [rule],
        exercise: { equipmentAccess: ["Bodyweight only"], injuryStatus: "yes", limitationTags: ["cardiovascular"] },
      })
    );
    expect(result.warnings.some((w) => w.includes("clinician"))).toBe(true);
  });

  it("prefers compound exercises for the first slots of a session", () => {
    const isolation = exercise({ movementPatterns: ["squat"], compound: false });
    const compound = exercise({ movementPatterns: ["squat"], compound: true });
    const result = fillSessionSlots(input({ slots: [slot({ slotOrder: 1 })], exercises: [isolation, compound] }));
    expect(result.filled[0].exerciseId).toBe(compound.id);
  });

  it("persists ranked alternatives for each filled slot", () => {
    const a = exercise({ movementPatterns: ["squat"] });
    const b = exercise({ movementPatterns: ["squat"] });
    const c = exercise({ movementPatterns: ["squat"] });
    const result = fillSessionSlots(input({ slots: [slot({})], exercises: [a, b, c] }));
    expect(result.filled[0].alternatives).toHaveLength(2);
    expect(result.filled[0].alternatives[0].rank).toBe(1);
    expect(result.filled[0].alternatives[1].rank).toBe(2);
  });

  it("is deterministic — identical inputs produce identical fills", () => {
    const exercises = [exercise({}), exercise({}), exercise({})];
    const slots = [slot({}), slot({ slotOrder: 2 })];
    const a = fillSessionSlots(input({ slots, exercises }));
    const b = fillSessionSlots(input({ slots, exercises }));
    expect(a.filled.map((f) => f.exerciseId)).toEqual(b.filled.map((f) => f.exerciseId));
  });
});
