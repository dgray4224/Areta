import { describe, expect, it } from "vitest";
import { sleepGoalsSchema } from "@/domains/sleep/schema";

describe("sleepGoalsSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(sleepGoalsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a negative target duration", () => {
    expect(sleepGoalsSchema.safeParse({ targetDurationHours: -1 }).success).toBe(false);
  });

  it("accepts a list of disruptors", () => {
    const result = sleepGoalsSchema.safeParse({ disruptors: ["Screens before bed", "Caffeine late in day"] });
    expect(result.success).toBe(true);
  });
});
