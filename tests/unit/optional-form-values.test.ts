import { describe, expect, it } from "vitest";
import { optionalNumberValue, optionalStringValue } from "@/platform/ui/FormField";
import { nutritionSchema } from "@/domains/nutrition/schema";
import { learningSchema } from "@/domains/learning/schema";

describe("optionalNumberValue", () => {
  it("converts an empty string to undefined instead of NaN", () => {
    expect(optionalNumberValue("")).toBeUndefined();
  });

  it("converts a numeric string to a number", () => {
    expect(optionalNumberValue("72.5")).toBe(72.5);
  });

  it("round-trips through an optional Zod number field without a NaN error", () => {
    const result = nutritionSchema.safeParse({ height: optionalNumberValue("") });
    expect(result.success).toBe(true);
  });
});

describe("optionalStringValue", () => {
  it("converts an empty string to undefined", () => {
    expect(optionalStringValue("")).toBeUndefined();
  });

  it("passes through a non-empty string", () => {
    expect(optionalStringValue("beginner")).toBe("beginner");
  });

  it("round-trips a blank <select> placeholder through an optional Zod enum field", () => {
    // Regression test: a blank `<option value="">` submits "", which
    // z.enum([...]).optional() rejects (only `undefined` is "not answered").
    // Left un-normalized, the form silently refuses to submit with no
    // visible error (see NutritionForm/LearningForm history).
    const nutritionResult = nutritionSchema.safeParse({
      trackingPreference: optionalStringValue(""),
    });
    expect(nutritionResult.success).toBe(true);

    const learningResult = learningSchema.safeParse({
      preferredFormat: optionalStringValue(""),
    });
    expect(learningResult.success).toBe(true);
  });

  it("still rejects an unrelated invalid enum value", () => {
    const result = nutritionSchema.safeParse({ trackingPreference: "obsessive" });
    expect(result.success).toBe(false);
  });
});
