import { describe, expect, it } from "vitest";
import { computeAchievements, immediatelyPreviousWeek } from "@/domains/review/achievements";
import type { WeeklyMetrics } from "@/domains/review/metrics";

const streaks = { currentLoggingStreakDays: 0, bestLoggingStreakDays: 0, currentAllTasksCompleteWeeks: 0 };

function m(overrides: Partial<WeeklyMetrics>): WeeklyMetrics {
  return {
    weekStart: "2026-09-20",
    calorieAdherencePercent: null,
    proteinAdherencePercent: null,
    taskCompletionPercent: null,
    workoutAdherencePercent: null,
    assumedIntakeSharePercent: null,
    ...overrides,
  } as WeeklyMetrics;
}

describe("computeAchievements", () => {
  // The real case: every meal assumed, so 79%/68% intake scored a
  // "personal best 74" the person never earned.
  it("leaves assumed intake out of the adherence score", () => {
    const facts = computeAchievements(
      m({ calorieAdherencePercent: 79, proteinAdherencePercent: 68, assumedIntakeSharePercent: 100, workoutAdherencePercent: 43 }),
      [],
      null,
      streaks
    );
    expect(facts.personalBestAdherenceScore).toBe(43);
  });

  it("counts reported intake alongside workouts", () => {
    const facts = computeAchievements(
      m({ calorieAdherencePercent: 80, proteinAdherencePercent: 70, assumedIntakeSharePercent: 20, workoutAdherencePercent: 60 }),
      [],
      null,
      streaks
    );
    expect(facts.personalBestAdherenceScore).toBe(70);
  });
});

describe("immediatelyPreviousWeek", () => {
  it("returns the prior week only when it is exactly one week earlier", () => {
    const current = m({ weekStart: "2026-09-20" });
    expect(immediatelyPreviousWeek(current, [{ metrics: m({ weekStart: "2026-09-13" }) }])?.weekStart).toBe("2026-09-13");
    expect(immediatelyPreviousWeek(current, [{ metrics: m({ weekStart: "2026-08-17" }) }])).toBeNull();
    expect(immediatelyPreviousWeek(current, [])).toBeNull();
  });
});
