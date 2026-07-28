import { describe, expect, it } from "vitest";
import { computeWeeklyMetrics, type WeeklyMetricsInput } from "@/domains/review/metrics";

function baseInput(overrides: Partial<WeeklyMetricsInput> = {}): WeeklyMetricsInput {
  return {
    weekStart: "2026-07-20",
    weightLogs: [],
    sleepLogs: [],
    nutritionLogs: [],
    recoveryLogs: [],
    studySessions: [],
    tasks: [],
    calorieTarget: null,
    proteinTarget: null,
    ...overrides,
  };
}

describe("computeWeeklyMetrics", () => {
  it("computes weight change from the first and last logs in the window", () => {
    const result = computeWeeklyMetrics(
      baseInput({
        weightLogs: [
          { loggedAt: "2026-07-22T08:00:00Z", weight: 220 },
          { loggedAt: "2026-07-20T08:00:00Z", weight: 222 },
          { loggedAt: "2026-07-26T08:00:00Z", weight: 218.5 },
        ],
      })
    );
    expect(result.weightChangeLb).toBe(-3.5);
    expect(result.averageWeightThisWeek).toBeCloseTo((220 + 222 + 218.5) / 3, 1);
  });

  it("returns null weight change with fewer than 2 logs", () => {
    const zero = computeWeeklyMetrics(baseInput({ weightLogs: [] }));
    const one = computeWeeklyMetrics(
      baseInput({ weightLogs: [{ loggedAt: "2026-07-22T08:00:00Z", weight: 220 }] })
    );
    expect(zero.weightChangeLb).toBeNull();
    expect(zero.averageWeightThisWeek).toBeNull();
    expect(one.weightChangeLb).toBeNull();
    expect(one.averageWeightThisWeek).toBe(220);
  });

  it("computes calorie and protein adherence as a percent of target", () => {
    const result = computeWeeklyMetrics(
      baseInput({
        nutritionLogs: [
          { date: "2026-07-20", calories: 2000, protein: 150 },
          { date: "2026-07-21", calories: 2200, protein: 170 },
        ],
        calorieTarget: 2100,
        proteinTarget: 160,
      })
    );
    expect(result.calorieAdherencePercent).toBe(100); // avg 2100 / 2100
    expect(result.proteinAdherencePercent).toBe(100); // avg 160 / 160
    expect(result.nutritionLoggingDays).toBe(2);
  });

  it("returns null adherence when there is no target or no logs", () => {
    const noTarget = computeWeeklyMetrics(
      baseInput({ nutritionLogs: [{ date: "2026-07-20", calories: 2000, protein: 150 }] })
    );
    expect(noTarget.calorieAdherencePercent).toBeNull();

    const noLogs = computeWeeklyMetrics(baseInput({ calorieTarget: 2100, proteinTarget: 160 }));
    expect(noLogs.calorieAdherencePercent).toBeNull();
    expect(noLogs.proteinAdherencePercent).toBeNull();
  });

  it("averages sleep duration across logged nights only", () => {
    const result = computeWeeklyMetrics(
      baseInput({
        sleepLogs: [
          { totalDurationMinutes: 420 },
          { totalDurationMinutes: 480 },
          { totalDurationMinutes: null },
        ],
      })
    );
    expect(result.averageSleepMinutes).toBe(450);
  });

  it("classifies pain/swelling trends from first-half vs second-half averages", () => {
    const improving = computeWeeklyMetrics(
      baseInput({
        recoveryLogs: [
          { date: "2026-07-20", pain: 7, swelling: 6 },
          { date: "2026-07-21", pain: 7, swelling: 6 },
          { date: "2026-07-24", pain: 3, swelling: 2 },
          { date: "2026-07-25", pain: 3, swelling: 2 },
        ],
      })
    );
    expect(improving.painTrend).toBe("improving");
    expect(improving.swellingTrend).toBe("improving");

    const worsening = computeWeeklyMetrics(
      baseInput({
        recoveryLogs: [
          { date: "2026-07-20", pain: 2, swelling: null },
          { date: "2026-07-25", pain: 6, swelling: null },
        ],
      })
    );
    expect(worsening.painTrend).toBe("worsening");
    expect(worsening.swellingTrend).toBe("insufficient_data");

    const stable = computeWeeklyMetrics(
      baseInput({
        recoveryLogs: [
          { date: "2026-07-20", pain: 4, swelling: null },
          { date: "2026-07-25", pain: 4.1, swelling: null },
        ],
      })
    );
    expect(stable.painTrend).toBe("stable");

    const none = computeWeeklyMetrics(baseInput({ recoveryLogs: [] }));
    expect(none.painTrend).toBe("insufficient_data");
  });

  it("computes task completion percent counting completed and partially_completed", () => {
    const result = computeWeeklyMetrics(
      baseInput({
        tasks: [
          { status: "completed", skipReason: null },
          { status: "partially_completed", skipReason: null },
          { status: "skipped", skipReason: "too tired" },
          { status: "planned", skipReason: null },
        ],
      })
    );
    expect(result.taskCompletionPercent).toBe(50);
  });

  it("dedupes missed-task reasons", () => {
    const result = computeWeeklyMetrics(
      baseInput({
        tasks: [
          { status: "skipped", skipReason: "too tired" },
          { status: "skipped", skipReason: "too tired" },
          { status: "skipped", skipReason: "no time" },
          { status: "skipped", skipReason: null },
        ],
      })
    );
    expect(result.missedTaskReasons.sort()).toEqual(["no time", "too tired"]);
  });

  it("sums learning minutes across the week", () => {
    const result = computeWeeklyMetrics(
      baseInput({
        studySessions: [{ durationMinutes: 30 }, { durationMinutes: 45 }, { durationMinutes: null }],
      })
    );
    expect(result.learningMinutes).toBe(75);
  });

  it("flags sparse data when fewer than 3 distinct logged days exist", () => {
    const sparse = computeWeeklyMetrics(
      baseInput({
        nutritionLogs: [{ date: "2026-07-20", calories: 2000, protein: null }],
      })
    );
    expect(sparse.isDataSparse).toBe(true);

    const notSparse = computeWeeklyMetrics(
      baseInput({
        nutritionLogs: [
          { date: "2026-07-20", calories: 2000, protein: null },
          { date: "2026-07-21", calories: 2000, protein: null },
        ],
        recoveryLogs: [{ date: "2026-07-22", pain: 3, swelling: null }],
      })
    );
    expect(notSparse.isDataSparse).toBe(false);
  });
});
