import { describe, expect, it } from "vitest";
import { buildWorkoutRationale, type RationaleSessionSummary } from "@/domains/workoutplan/rationale";

function session(overrides: Partial<NonNullable<RationaleSessionSummary>>): NonNullable<RationaleSessionSummary> {
  return { name: "Session", sessionType: "strength", exerciseCount: 5, ...overrides };
}

describe("buildWorkoutRationale", () => {
  it("returns null when today has no session (rest day)", () => {
    expect(buildWorkoutRationale({ today: null, tomorrow: null })).toBeNull();
  });

  it("explains a strength day ahead of endurance work tomorrow", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Strength Support", sessionType: "strength", exerciseCount: 4 }),
      tomorrow: session({ name: "Long Run", sessionType: "run", exerciseCount: 1 }),
    });
    expect(result).toBe('Kept today at 4 exercises to keep your legs fresh for tomorrow\'s "Long Run."');
  });

  it("singularizes exercise count of 1", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Strength Support", sessionType: "strength", exerciseCount: 1 }),
      tomorrow: session({ name: "Long Run", sessionType: "run", exerciseCount: 1 }),
    });
    expect(result).toContain("1 exercise to");
  });

  it("compares two strength days by real exercise count, lighter today", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Light Strength", sessionType: "strength", exerciseCount: 4 }),
      tomorrow: session({ name: "Heavy Strength", sessionType: "strength", exerciseCount: 5 }),
    });
    expect(result).toBe('Lighter strength day today (4 exercises) -- tomorrow\'s "Heavy Strength" carries more volume.');
  });

  it("compares two strength days by real exercise count, heavier today", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Heavy Strength", sessionType: "strength", exerciseCount: 7 }),
      tomorrow: session({ name: "Light Strength", sessionType: "strength", exerciseCount: 4 }),
    });
    expect(result).toBe('Today carries more volume than tomorrow\'s "Light Strength," which is intentionally lighter to help you recover.');
  });

  it("returns no rationale when today and tomorrow have equal strength volume", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Push A", sessionType: "strength", exerciseCount: 7 }),
      tomorrow: session({ name: "Pull A", sessionType: "strength", exerciseCount: 7 }),
    });
    expect(result).toBeNull();
  });

  it("frames endurance-today/strength-tomorrow around tomorrow's recovery", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Long Run", sessionType: "run", exerciseCount: 1 }),
      tomorrow: session({ name: "Heavy Strength", sessionType: "strength", exerciseCount: 5 }),
    });
    expect(result).toBe('Today\'s "Long Run" is the priority -- tomorrow\'s strength session follows once you\'ve recovered from it.');
  });

  it("returns null when no today/tomorrow relationship applies", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Circuit A", sessionType: "circuit", exerciseCount: 6 }),
      tomorrow: null,
    });
    expect(result).toBeNull();
  });

  it("returns null for two different non-strength/endurance session types with no defined relationship", () => {
    const result = buildWorkoutRationale({
      today: session({ name: "Circuit A", sessionType: "circuit", exerciseCount: 6 }),
      tomorrow: session({ name: "Circuit B", sessionType: "circuit", exerciseCount: 6 }),
    });
    expect(result).toBeNull();
  });
});
