import { describe, expect, it } from "vitest";

import { dayMetricTotal } from "@/domains/activity-summary/day-total";

describe("dayMetricTotal", () => {
  it("returns null when the day has no rows", () => {
    expect(dayMetricTotal([])).toBeNull();
    expect(dayMetricTotal(null)).toBeNull();
    expect(dayMetricTotal(undefined)).toBeNull();
  });

  it("sums raw samples when no rollup exists", () => {
    expect(
      dayMetricTotal([
        { value: 120, dedup_key: "sample-a" },
        { value: 80, dedup_key: "sample-b" },
      ])
    ).toBe(200);
  });

  it("treats a missing value as zero rather than poisoning the sum", () => {
    expect(
      dayMetricTotal([
        { value: 120, dedup_key: "sample-a" },
        { value: null, dedup_key: "sample-b" },
      ])
    ).toBe(120);
  });

  it("prefers the rollup over raw samples instead of adding both", () => {
    // The bug this guards: 450 (the day's real total) + 120 + 80 = 650.
    const rows = [
      { value: 120, dedup_key: "sample-a" },
      { value: 450, dedup_key: "daily-active_energy-2026-09-26" },
      { value: 80, dedup_key: "sample-b" },
    ];
    expect(dayMetricTotal(rows)).toBe(450);
  });

  it("uses the rollup even when it is the only row", () => {
    expect(dayMetricTotal([{ value: 3200, dedup_key: "daily-distance_walking_running-2026-09-26" }])).toBe(3200);
  });

  it("tolerates rows with no dedup key at all", () => {
    expect(
      dayMetricTotal([
        { value: 10, dedup_key: null },
        { value: 15, dedup_key: null },
      ])
    ).toBe(25);
  });
});
