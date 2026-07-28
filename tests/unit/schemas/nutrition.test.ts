import { describe, expect, it } from "vitest";
import { nutritionSchema } from "@/domains/nutrition/schema";

describe("nutritionSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(nutritionSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a negative weight", () => {
    expect(nutritionSchema.safeParse({ currentWeight: -5 }).success).toBe(false);
  });

  it("rejects an out-of-range meals-per-day", () => {
    expect(nutritionSchema.safeParse({ mealsPerDay: 20 }).success).toBe(false);
  });
});
