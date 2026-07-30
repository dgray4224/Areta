import { describe, expect, it } from "vitest";
import { workScheduleSchema } from "@/domains/identity/schema";

describe("workScheduleSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(workScheduleSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully filled-in schedule", () => {
    const result = workScheduleSchema.safeParse({
      workStatus: "Remote, full-time",
      workHoursNote: "9am-5pm weekdays",
      schoolCommitments: "OMSA begins January",
      learningTimeMinutesPerWeek: 300,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative learning time", () => {
    expect(
      workScheduleSchema.safeParse({ learningTimeMinutesPerWeek: -10 }).success
    ).toBe(false);
  });
});
