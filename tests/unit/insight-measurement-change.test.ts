import { describe, expect, it } from "vitest";
import {
  detectChangepoints,
  seriesSinceLastMeasurementChange,
  type SeriesPoint,
} from "@/domains/insights/generators/changepoint";
import { generateStepPortrait } from "@/domains/insights/generators/step-portrait";

/**
 * The measurement discount: what happens after a user answers the
 * annotation loop with "it was a new watch or phone".
 *
 * The shape under test is the real one from the account this was built
 * against — a year of phone-only steps at ~2,900 a day, then a watch, then
 * years at ~12,000. Left alone that seam is the most confident finding in
 * the whole dataset and it is about a purchase, not a life.
 */

const WATCH_DAY = "2021-02-04";

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Deterministic jitter — a flat line has zero variance, which makes the
 * Welch statistic infinite and the test meaningless. */
function wobble(i: number, amplitude: number): number {
  return Math.round(Math.sin(i * 2.399) * amplitude);
}

/** A year on a phone, then a watch, and nothing else changes. */
function watchArrivalSeries(): SeriesPoint[] {
  const series: SeriesPoint[] = [];
  const start = "2020-02-10";
  const beforeDays = Math.round(
    (Date.parse(`${WATCH_DAY}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
  );
  for (let i = 0; i < beforeDays; i++) {
    series.push({ day: addDays(start, i), value: 2900 + wobble(i, 400) });
  }
  for (let i = 0; i < 700; i++) {
    series.push({ day: addDays(WATCH_DAY, i), value: 12000 + wobble(i, 900) });
  }
  return series;
}

describe("detectChangepoints with a confirmed measurement change", () => {
  it("reports the seam as a changepoint when the user has not annotated it", () => {
    const found = detectChangepoints(watchArrivalSeries());
    expect(found.some((c) => c.day === WATCH_DAY)).toBe(true);
  });

  it("never tests across a day the user called an instrument change", () => {
    const found = detectChangepoints(watchArrivalSeries(), { measurementChangeDays: [WATCH_DAY] });
    expect(found.some((c) => c.day === WATCH_DAY)).toBe(false);
    // Nor anywhere else on this series: on each side of the seam there is
    // only one step level, so there is genuinely nothing left to find.
    expect(found).toHaveLength(0);
  });

  it("still finds a real break inside the earlier instrument's era", () => {
    // The phone year is not written off. A genuine change in 2020 is still
    // a change in a life, and the loop should still ask about it.
    const series = watchArrivalSeries().map((point, i) =>
      point.day < WATCH_DAY && point.day >= "2020-08-01"
        ? { ...point, value: 6500 + wobble(i, 400) }
        : point
    );
    const found = detectChangepoints(series, { measurementChangeDays: [WATCH_DAY] });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => c.day < WATCH_DAY)).toBe(true);
  });

  it("ignores a change day that falls on or before the first observed day", () => {
    const series = watchArrivalSeries();
    const withEarly = detectChangepoints(series, { measurementChangeDays: [series[0].day] });
    expect(withEarly).toEqual(detectChangepoints(series));
  });
});

describe("seriesSinceLastMeasurementChange", () => {
  const series = watchArrivalSeries();

  it("returns the whole series when nothing has been annotated", () => {
    expect(seriesSinceLastMeasurementChange(series, [])).toBe(series);
  });

  it("keeps the change day itself and everything after it", () => {
    const kept = seriesSinceLastMeasurementChange(series, [WATCH_DAY]);
    expect(kept[0].day).toBe(WATCH_DAY);
    expect(kept[kept.length - 1]).toEqual(series[series.length - 1]);
  });

  it("uses the most recent change when there are several", () => {
    const kept = seriesSinceLastMeasurementChange(series, ["2020-06-01", WATCH_DAY]);
    expect(kept[0].day).toBe(WATCH_DAY);
  });

  it("ignores a change dated after the end of the record", () => {
    expect(seriesSinceLastMeasurementChange(series, ["2030-01-01"])).toBe(series);
  });
});

describe("generateStepPortrait after a measurement change", () => {
  const series = watchArrivalSeries();
  const base = {
    series,
    dayOfWeek: new Map(series.map((p) => [p.day, new Date(`${p.day}T00:00:00Z`).getUTCDay()])),
    mostActiveHour: new Map<string, number>(),
    activeGoalDomains: new Set<string>(),
    today: series[series.length - 1].day,
  };

  it("announces the watch as a life change when it has not been told otherwise", () => {
    const { candidates } = generateStepPortrait(base);
    const changepoint = candidates.find((c) => c.type === "changepoint");
    expect(changepoint?.facts).toMatchObject({ day: WATCH_DAY, direction: "up" });
  });

  it("stops announcing it once the user says it was the watch", () => {
    const { candidates } = generateStepPortrait({ ...base, measurementChangeDays: [WATCH_DAY] });
    expect(candidates.find((c) => c.type === "changepoint")).toBeUndefined();
  });

  it("stops crowning a post-watch month over the phone-only year", () => {
    const before = generateStepPortrait(base).candidates.find((c) => c.type === "peak_month");
    const after = generateStepPortrait({
      ...base,
      measurementChangeDays: [WATCH_DAY],
    }).candidates.find((c) => c.type === "peak_month");

    // Before: the phone year drags the comparison average down, so the
    // peak month looks far more exceptional than it was.
    const beforeCompared = (before?.facts as { comparedTo: number }).comparedTo;
    const afterCompared = (after?.facts as { comparedTo: number }).comparedTo;
    expect(beforeCompared).toBeLessThan(afterCompared);
    expect(after?.score).toBeLessThan(before?.score ?? 1);
  });
});
