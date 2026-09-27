import { describe, expect, it } from "vitest";
import { computePlanExecution } from "@/domains/review/plan-execution";
import type { WeeklyMetrics } from "@/domains/review/metrics";

function week(weekStart: string, planned: number, adherence: number | null) {
  return {
    weekStart,
    metrics: { workoutsPlanned: planned, workoutAdherencePercent: adherence } as WeeklyMetrics,
  };
}

describe("computePlanExecution", () => {
  it("does not warrant a plan change after one missed week", () => {
    const facts = computePlanExecution([week("2026-09-27", 7, 43), week("2026-09-20", 7, 100)]);
    expect(facts.missedWeeksInARow).toBe(1);
    expect(facts.planChangeWarranted).toBe(false);
  });

  it("warrants a plan change after a month of consecutive missed weeks", () => {
    const facts = computePlanExecution([
      week("2026-09-27", 7, 43),
      week("2026-09-20", 7, 29),
      week("2026-09-13", 7, 57),
      week("2026-09-06", 7, 0),
    ]);
    expect(facts.missedWeeksInARow).toBe(4);
    expect(facts.planChangeWarranted).toBe(true);
  });

  it("ends the run at an executed week", () => {
    const facts = computePlanExecution([
      week("2026-09-27", 7, 43),
      week("2026-09-20", 7, 29),
      week("2026-09-13", 7, 86),
      week("2026-09-06", 7, 0),
      week("2026-08-30", 7, 0),
    ]);
    expect(facts.missedWeeksInARow).toBe(2);
  });

  // Unknown is not missed: a skipped week or one with no plan can't count
  // against the person.
  it("ends the run at a gap in weeks or a week with nothing planned", () => {
    expect(
      computePlanExecution([week("2026-09-27", 7, 0), week("2026-09-13", 7, 0), week("2026-09-06", 7, 0)])
        .missedWeeksInARow
    ).toBe(1);
    expect(
      computePlanExecution([week("2026-09-27", 7, 0), week("2026-09-20", 0, null), week("2026-09-13", 7, 0)])
        .missedWeeksInARow
    ).toBe(1);
  });
});
