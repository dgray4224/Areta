import { describe, expect, it } from "vitest";
import { computeGoalTrajectories, type GoalWithTarget } from "@/domains/review/trajectory";
import type { WeeklyMetrics } from "@/domains/review/metrics";

function goal(overrides: Partial<GoalWithTarget> = {}): GoalWithTarget {
  return {
    id: "g1",
    targetMetricType: "weight_lb",
    targetValue: 180,
    targetDirection: "decrease",
    targetDate: null,
    baselineValue: null,
    baselineRecordedAt: null,
    ...overrides,
  };
}

function metricsWeek(overrides: Partial<WeeklyMetrics> = {}): WeeklyMetrics {
  return {
    weekStart: "2026-01-04",
    weightChangeLb: null,
    averageWeightThisWeek: null,
    proteinAdherencePercent: null,
    calorieAdherencePercent: null,
    nutritionLoggingDays: 0,
    averageSleepMinutes: null,
    recoveryLoggingDays: 0,
    painTrend: "insufficient_data",
    swellingTrend: "insufficient_data",
    averagePainThisWeek: null,
    averageSwellingThisWeek: null,
    learningMinutes: 0,
    taskCompletionPercent: null,
    missedTaskReasons: [],
    isDataSparse: false,
    averageRestingHeartRate: null,
    averageHeartRateVariability: null,
    averageVo2Max: null,
    ...overrides,
  };
}

describe("computeGoalTrajectories — projectedCompletionDate", () => {
  it("insufficient_data (fewer than 3 points): null completion date", () => {
    const [trajectory] = computeGoalTrajectories([goal()], [
      { weekStart: "2026-01-04", metrics: metricsWeek({ weekStart: "2026-01-04", averageWeightThisWeek: 195 }) },
    ]);
    expect(trajectory.paceStatus).toBe("insufficient_data");
    expect(trajectory.projectedCompletionDate).toBeNull();
  });

  it("already at/past target: completion date is the latest data point's date", () => {
    const history = [
      { weekStart: "2026-01-04", metrics: metricsWeek({ weekStart: "2026-01-04", averageWeightThisWeek: 182 }) },
      { weekStart: "2026-01-11", metrics: metricsWeek({ weekStart: "2026-01-11", averageWeightThisWeek: 179 }) },
      { weekStart: "2026-01-18", metrics: metricsWeek({ weekStart: "2026-01-18", averageWeightThisWeek: 178 }) },
    ];
    const [trajectory] = computeGoalTrajectories([goal({ targetValue: 180 })], history);
    expect(trajectory.paceStatus).toBe("ahead");
    expect(trajectory.projectedWeeksNeeded).toBe(0);
    expect(trajectory.projectedCompletionDate).toBe("2026-01-18");
  });

  it("on_pace (no targetDate): completion date is latest point + projectedWeeksNeeded", () => {
    // Losing 1 lb/week, starting 195 -> 193 over 2 weeks, target 180: gap 13 lb / 1 lb/week = 13 weeks.
    const history = [
      { weekStart: "2026-01-04", metrics: metricsWeek({ weekStart: "2026-01-04", averageWeightThisWeek: 195 }) },
      { weekStart: "2026-01-11", metrics: metricsWeek({ weekStart: "2026-01-11", averageWeightThisWeek: 194 }) },
      { weekStart: "2026-01-18", metrics: metricsWeek({ weekStart: "2026-01-18", averageWeightThisWeek: 193 }) },
    ];
    const [trajectory] = computeGoalTrajectories([goal({ targetValue: 180, targetDate: null })], history);
    expect(trajectory.paceStatus).toBe("on_pace");
    expect(trajectory.projectedWeeksNeeded).toBe(13);
    expect(trajectory.projectedCompletionDate).toBe("2026-04-19"); // 2026-01-18 + 13 weeks
  });

  it("behind with a real (positive) rate but a target date too soon: still gets a completion date, just later than the deadline", () => {
    const history = [
      { weekStart: "2026-01-04", metrics: metricsWeek({ weekStart: "2026-01-04", averageWeightThisWeek: 195 }) },
      { weekStart: "2026-01-11", metrics: metricsWeek({ weekStart: "2026-01-11", averageWeightThisWeek: 194 }) },
      { weekStart: "2026-01-18", metrics: metricsWeek({ weekStart: "2026-01-18", averageWeightThisWeek: 193 }) },
    ];
    const [trajectory] = computeGoalTrajectories(
      [goal({ targetValue: 180, targetDate: "2026-01-25" })], // 1 week away, nowhere near enough
      history
    );
    expect(trajectory.paceStatus).toBe("behind");
    expect(trajectory.projectedWeeksNeeded).toBe(13);
    expect(trajectory.projectedCompletionDate).toBe("2026-04-19");
  });

  it("flat/negative rate (wrong direction): null completion date, never fabricated", () => {
    const history = [
      { weekStart: "2026-01-04", metrics: metricsWeek({ weekStart: "2026-01-04", averageWeightThisWeek: 190 }) },
      { weekStart: "2026-01-11", metrics: metricsWeek({ weekStart: "2026-01-11", averageWeightThisWeek: 191 }) },
      { weekStart: "2026-01-18", metrics: metricsWeek({ weekStart: "2026-01-18", averageWeightThisWeek: 192 }) },
    ];
    const [trajectory] = computeGoalTrajectories([goal({ targetValue: 180 })], history);
    expect(trajectory.paceStatus).toBe("behind");
    expect(trajectory.projectedWeeksNeeded).toBeNull();
    expect(trajectory.projectedCompletionDate).toBeNull();
  });

  it("crosses a year boundary correctly", () => {
    // Losing 2 lb/week; 6 lb remaining / 2 lb/week = 3 weeks from 2025-12-21.
    const history = [
      { weekStart: "2025-12-07", metrics: metricsWeek({ weekStart: "2025-12-07", averageWeightThisWeek: 190 }) },
      { weekStart: "2025-12-14", metrics: metricsWeek({ weekStart: "2025-12-14", averageWeightThisWeek: 188 }) },
      { weekStart: "2025-12-21", metrics: metricsWeek({ weekStart: "2025-12-21", averageWeightThisWeek: 186 }) },
    ];
    const [trajectory] = computeGoalTrajectories([goal({ targetValue: 180, targetDate: null })], history);
    expect(trajectory.paceStatus).toBe("on_pace");
    expect(trajectory.projectedWeeksNeeded).toBe(3);
    expect(trajectory.projectedCompletionDate).toBe("2026-01-11"); // 2025-12-21 + 3 weeks, crossing into 2026
  });
});
