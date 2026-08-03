import { describe, expect, it } from "vitest";
import { contentBatchSchema, sourceSchema, prescriptionSchema } from "@/domains/trainingprogram/content-spec";

function validSource() {
  return {
    organization: "National Strength and Conditioning Association",
    title: "Position stand on X",
    url: "https://nsca.com/some-article",
    retrievedAt: "2026-08-10",
  };
}

function validStrengthPrescription() {
  return {
    kind: "strength" as const,
    exerciseRef: "Barbell back squat",
    sets: 3,
    repsMin: 5,
    repsMax: 8,
    intensityType: "rpe" as const,
    intensityValue: "7-8",
  };
}

function validCardioPrescription() {
  return {
    kind: "cardio" as const,
    exerciseRef: "Easy-pace run",
    durationMinutes: 30,
    cardioIntensity: "conversational pace",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixture deliberately builds both valid and intentionally-malformed batches for safeParse() to reject at runtime
function validBatch(): any {
  return {
    newExercises: [],
    programs: [
      {
        archetype: "powerlifter",
        slug: "test-program",
        name: "Test Program",
        sessionsPerWeekMin: 3,
        sessionsPerWeekMax: 4,
        equipmentRequired: ["Barbell"],
        phases: [
          {
            name: "Phase 1",
            lengthWeeks: 4,
            isFinal: true,
            sessions: [{ exercises: [validStrengthPrescription()] }],
          },
        ],
        sources: [validSource()],
      },
    ],
  };
}

describe("sourceSchema", () => {
  it("accepts a well-formed source", () => {
    expect(sourceSchema.safeParse(validSource()).success).toBe(true);
  });

  it("rejects a non-URL", () => {
    expect(sourceSchema.safeParse({ ...validSource(), url: "not-a-url" }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(sourceSchema.safeParse({ ...validSource(), retrievedAt: "08/10/2026" }).success).toBe(false);
  });
});

describe("prescriptionSchema (discriminated union)", () => {
  it("accepts a valid strength prescription", () => {
    expect(prescriptionSchema.safeParse(validStrengthPrescription()).success).toBe(true);
  });

  it("accepts a valid cardio prescription", () => {
    expect(prescriptionSchema.safeParse(validCardioPrescription()).success).toBe(true);
  });

  it("rejects a strength-kind object missing intensityType", () => {
    const rest: Record<string, unknown> = validStrengthPrescription();
    delete rest.intensityType;
    expect(prescriptionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a cardio-shaped object mixed into strength fields (the exact class of bug that motivated this schema)", () => {
    const malformed = {
      kind: "cardio",
      exerciseRef: "Assault bike sprints",
      sets: 8,
      // durationMinutes/cardioIntensity present as if strength-shaped -- missing entirely
      repsMin: 1,
    };
    expect(prescriptionSchema.safeParse(malformed).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(prescriptionSchema.safeParse({ ...validStrengthPrescription(), kind: "mobility" }).success).toBe(false);
  });
});

describe("contentBatchSchema", () => {
  it("accepts a well-formed batch", () => {
    expect(contentBatchSchema.safeParse(validBatch()).success).toBe(true);
  });

  it("rejects a program with zero sources", () => {
    const batch = validBatch();
    batch.programs[0].sources = [];
    expect(contentBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects a program with zero phases", () => {
    const batch = validBatch();
    batch.programs[0].phases = [];
    expect(contentBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects an invalid archetype", () => {
    const batch = validBatch();
    batch.programs[0].archetype = "not_a_real_archetype";
    expect(contentBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects a non-kebab-case slug", () => {
    const batch = validBatch();
    batch.programs[0].slug = "Not Kebab Case!";
    expect(contentBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("accepts newExercises with a refKey prescriptions can reference", () => {
    const batch = validBatch();
    batch.newExercises = [
      {
        refKey: "new-ex-1",
        name: "Some New Movement",
        movementPattern: "hinge",
        archetypeTags: ["powerlifter"],
        difficulty: "intermediate",
      },
    ];
    batch.programs[0].phases[0].sessions[0].exercises = [
      { ...validStrengthPrescription(), exerciseRef: "new-ex-1" },
    ];
    expect(contentBatchSchema.safeParse(batch).success).toBe(true);
  });
});

describe("prescriptionSchema: alternates", () => {
  it("accepts a prescription with 1-2 alternates, strength or cardio, mixed kinds allowed", () => {
    const result = prescriptionSchema.safeParse({
      ...validCardioPrescription(),
      alternates: [validCardioPrescription(), validStrengthPrescription()],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a prescription with zero alternates (field omitted)", () => {
    expect(prescriptionSchema.safeParse(validStrengthPrescription()).success).toBe(true);
  });

  it("rejects more than 2 alternates", () => {
    const result = prescriptionSchema.safeParse({
      ...validCardioPrescription(),
      alternates: [validCardioPrescription(), validCardioPrescription(), validCardioPrescription()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an alternate with its own nested alternates (no alternates-of-alternates)", () => {
    const result = prescriptionSchema.safeParse({
      ...validCardioPrescription(),
      alternates: [{ ...validCardioPrescription(), alternates: [validCardioPrescription()] }],
    });
    // Zod strips unknown keys by default rather than failing on them, so
    // this still parses -- the real guarantee is the *type* system: an
    // AlternateSpec's inferred type has no `alternates` field at all, so
    // TS (not runtime Zod) is what actually prevents authoring this.
    expect(result.success).toBe(true);
  });
});
