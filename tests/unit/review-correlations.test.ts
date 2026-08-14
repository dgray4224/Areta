import { describe, expect, it } from "vitest";
import { computeMetricCorrelations } from "@/domains/review/correlations";
import type { WeeklyMetrics } from "@/domains/review/metrics";

function week(weekStart: string, overrides: Partial<WeeklyMetrics>): { weekStart: string; metrics: WeeklyMetrics } {
  return {
    weekStart,
    metrics: {
      weekStart,
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
    },
  };
}

function weekStartFor(i: number): string {
  const d = new Date(Date.UTC(2026, 4, 4 + i * 7));
  return d.toISOString().slice(0, 10);
}

describe("computeMetricCorrelations (hardened 2026-08-14)", () => {
  it("finds a strong, significant sleep-completion relationship over 12 weeks", () => {
    // Near-linear: completion tracks sleep almost exactly.
    const history = Array.from({ length: 12 }, (_, i) =>
      week(weekStartFor(i), {
        averageSleepMinutes: 360 + i * 12,
        taskCompletionPercent: 50 + i * 4 + (i % 2),
      })
    );
    const findings = computeMetricCorrelations(history);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].metricA).toBe("averageSleepMinutes");
    expect(findings[0].metricB).toBe("taskCompletionPercent");
    expect(findings[0].direction).toBe("positive");
  });

  it("rejects a moderate-|r| fluke at small n that the old guards allowed", () => {
    // 6 paired weeks of unrelated values whose sample r can exceed 0.5 by
    // chance — the pre-hardening engine (MIN_PAIRED_WEEKS=4, no
    // significance test) reported these as findings routinely. The
    // Bonferroni-corrected permutation gate should stay silent.
    const sleep = [400, 460, 380, 470, 430, 410];
    const completion = [55, 75, 60, 70, 72, 58];
    const history = sleep.map((s, i) =>
      week(weekStartFor(i), { averageSleepMinutes: s, taskCompletionPercent: completion[i] })
    );
    expect(computeMetricCorrelations(history)).toHaveLength(0);
  });

  it("still enforces the minimum paired weeks", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      week(weekStartFor(i), {
        averageSleepMinutes: 360 + i * 20,
        taskCompletionPercent: 50 + i * 8,
      })
    );
    expect(computeMetricCorrelations(history)).toHaveLength(0);
  });
});
