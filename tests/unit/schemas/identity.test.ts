import { describe, expect, it } from "vitest";
import { identitySchema } from "@/domains/identity/schema";

const validInput = {
  fullName: "Founder",
  timeZone: "America/New_York",
  units: "imperial" as const,
  wakeTime: "06:30",
  bedTime: "22:30",
  weeklyReviewDay: 0,
  groceryDay: 6,
  mealPrepDay: 0,
};

describe("identitySchema", () => {
  it("accepts valid input", () => {
    expect(identitySchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(identitySchema.safeParse({ ...validInput, fullName: "" }).success).toBe(false);
  });

  it("rejects a malformed time", () => {
    expect(identitySchema.safeParse({ ...validInput, wakeTime: "6:30am" }).success).toBe(false);
  });

  it("rejects an out-of-range weekday", () => {
    expect(identitySchema.safeParse({ ...validInput, groceryDay: 7 }).success).toBe(false);
  });
});
