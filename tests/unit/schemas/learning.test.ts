import { describe, expect, it } from "vitest";
import { learningSchema } from "@/domains/learning/schema";

describe("learningSchema", () => {
  it("accepts an empty object", () => {
    expect(learningSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a negative weekly-hours value", () => {
    expect(learningSchema.safeParse({ weeklyAvailableHours: -1 }).success).toBe(false);
  });

  it("rejects an unknown preferred format", () => {
    expect(learningSchema.safeParse({ preferredFormat: "podcast" }).success).toBe(false);
  });
});
