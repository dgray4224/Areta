import { describe, expect, it } from "vitest";
import { exerciseSchema, exerciseLogSchema } from "@/domains/exercise/schema";

describe("exerciseSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(exerciseSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unknown primaryGoal", () => {
    expect(exerciseSchema.safeParse({ primaryGoal: "not_a_real_goal" }).success).toBe(false);
  });

  it("rejects an unknown daysPerWeek option", () => {
    expect(exerciseSchema.safeParse({ daysPerWeek: "10" }).success).toBe(false);
  });

  it("rejects an unknown limitationTag", () => {
    expect(exerciseSchema.safeParse({ limitationTags: ["not_a_real_tag"] }).success).toBe(false);
  });

  it("accepts a fully filled-out goal-first response", () => {
    const result = exerciseSchema.safeParse({
      primaryGoal: "build_muscle",
      recentExperience: "consistent",
      daysPerWeek: "4",
      sessionDurationBand: "45",
      trainingLocation: "full_gym",
      equipmentAccess: ["Barbell", "Dumbbells"],
      preferredActivities: ["strength_training"],
      dislikedActivities: ["Running"],
      injuryStatus: "no",
      goalDetail: { muscleGainFocus: "balanced" },
    });
    expect(result.success).toBe(true);
  });

  it("requires an eventType when primaryGoal is train_for_event and goalDetail is present", () => {
    const result = exerciseSchema.safeParse({
      primaryGoal: "train_for_event",
      goalDetail: { eventDistance: "10k" },
    });
    expect(result.success).toBe(false);
  });

  it("requires prioritizedMuscleAreas when muscleGainFocus is prioritized_areas", () => {
    const result = exerciseSchema.safeParse({
      primaryGoal: "build_muscle",
      goalDetail: { muscleGainFocus: "prioritized_areas", prioritizedMuscleAreas: [] },
    });
    expect(result.success).toBe(false);
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
