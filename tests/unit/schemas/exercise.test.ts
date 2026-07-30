import { describe, expect, it } from "vitest";
import { exerciseSchema, exerciseLogSchema } from "@/domains/exercise/schema";

describe("exerciseSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(exerciseSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unknown archetype", () => {
    expect(exerciseSchema.safeParse({ archetype: "triathlete" }).success).toBe(false);
  });

  it("rejects an out-of-range days-per-week", () => {
    expect(exerciseSchema.safeParse({ daysPerWeekAvailable: 10 }).success).toBe(false);
  });
});

describe("exerciseLogSchema", () => {
  it("requires a date", () => {
    expect(exerciseLogSchema.safeParse({}).success).toBe(false);
    expect(exerciseLogSchema.safeParse({ date: "2026-07-30" }).success).toBe(true);
  });

  it("rejects perceived exertion outside 1-10", () => {
    expect(
      exerciseLogSchema.safeParse({ date: "2026-07-30", perceivedExertion: 11 }).success
    ).toBe(false);
  });
});
