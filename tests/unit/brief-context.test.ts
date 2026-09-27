import { describe, expect, it } from "vitest";
import { toBriefMetrics } from "@/domains/review/context-builder";
import type { WeeklyMetrics } from "@/domains/review/metrics";

function m(overrides: Partial<WeeklyMetrics>): WeeklyMetrics {
  return {
    calorieAdherencePercent: 79,
    proteinAdherencePercent: 68,
    assumedIntakeSharePercent: 100,
    workoutsAutoCompleted: 3,
    mealsConfirmed: 0,
    mealsAssumed: 3,
    nutritionLoggingDays: 2,
    recoveryLoggingDays: 0,
    ...overrides,
  } as WeeklyMetrics;
}

describe("toBriefMetrics", () => {
  it("withholds intake percentages the person never reported", () => {
    const out = toBriefMetrics(m({}));
    expect(out.intakeVisible).toBe(false);
    expect(out.calorieAdherencePercent).toBeNull();
    expect(out.proteinAdherencePercent).toBeNull();
  });

  it("keeps intake percentages that were mostly reported", () => {
    const out = toBriefMetrics(m({ assumedIntakeSharePercent: 20 }));
    expect(out.intakeVisible).toBe(true);
    expect(out.proteinAdherencePercent).toBe(68);
  });

  it("drops how the data got in, so the brief can't narrate it", () => {
    const out = toBriefMetrics(m({})) as Record<string, unknown>;
    for (const key of ["workoutsAutoCompleted", "mealsConfirmed", "mealsAssumed", "assumedIntakeSharePercent", "nutritionLoggingDays", "recoveryLoggingDays"]) {
      expect(out).not.toHaveProperty(key);
    }
  });
});
