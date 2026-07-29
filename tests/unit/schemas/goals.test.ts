import { describe, expect, it } from "vitest";
import { goalSchema, goalsStepSchema } from "@/domains/goals/schema";

const validGoal = {
  domainKey: "nutrition" as const,
  outcome: "Weigh 200 pounds",
  priority: 2,
  confidence: 3,
};

describe("goalSchema", () => {
  it("accepts a minimal valid goal", () => {
    expect(goalSchema.safeParse(validGoal).success).toBe(true);
  });

  it("rejects an empty outcome", () => {
    expect(goalSchema.safeParse({ ...validGoal, outcome: "" }).success).toBe(false);
  });

  it("rejects an unknown domain", () => {
    expect(goalSchema.safeParse({ ...validGoal, domainKey: "astrology" }).success).toBe(false);
  });

  it("rejects confidence outside 1-5", () => {
    expect(goalSchema.safeParse({ ...validGoal, confidence: 6 }).success).toBe(false);
  });
});

describe("goalsStepSchema", () => {
  it("requires at least one goal", () => {
    expect(goalsStepSchema.safeParse({ goals: [] }).success).toBe(false);
  });

  it("accepts a list of valid goals", () => {
    expect(goalsStepSchema.safeParse({ goals: [validGoal] }).success).toBe(true);
  });
});
