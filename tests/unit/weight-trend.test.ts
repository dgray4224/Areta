import { describe, expect, it } from "vitest";
import { computeSevenDayMovingAverage } from "@/domains/weight/trend";

describe("computeSevenDayMovingAverage", () => {
  it("returns the single value itself for one data point", () => {
    const result = computeSevenDayMovingAverage([{ loggedAt: "2026-01-01T08:00:00Z", weight: 200 }]);
    expect(result).toHaveLength(1);
    expect(result[0].sevenDayAverage).toBe(200);
  });

  it("averages only points within the trailing 7-day window", () => {
    const points = [
      { loggedAt: "2026-01-01T08:00:00Z", weight: 210 },
      { loggedAt: "2026-01-05T08:00:00Z", weight: 208 },
      // 10 days after the first point — outside its own window, but the
      // first point is outside *this* point's trailing window too.
      { loggedAt: "2026-01-11T08:00:00Z", weight: 204 },
    ];
    const result = computeSevenDayMovingAverage(points);
    // Last point's window only includes itself and the Jan 5 point (within 7 days).
    expect(result[2].sevenDayAverage).toBe((208 + 204) / 2);
  });

  it("sorts unordered input chronologically before averaging", () => {
    const points = [
      { loggedAt: "2026-01-03T08:00:00Z", weight: 202 },
      { loggedAt: "2026-01-01T08:00:00Z", weight: 200 },
    ];
    const result = computeSevenDayMovingAverage(points);
    expect(result[0].loggedAt).toBe("2026-01-01T08:00:00Z");
    expect(result[1].sevenDayAverage).toBe(201);
  });
});
