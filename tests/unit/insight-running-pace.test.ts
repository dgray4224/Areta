import { describe, expect, it } from "vitest";
import { detectRunningPaceRecord, isPlausibleRun, paceSecondsPerMile, MILE_METERS, type RunForPace } from "@/domains/insights/detectors/running-pace";
import { isBetterRecord } from "@/domains/insights/same-day-records";
import { formatPace } from "@/domains/insights/templates";

const TODAY = "2026-09-04";

function run(day: string, miles: number, secondsPerMile: number): RunForPace {
  return { day, distanceMeters: miles * MILE_METERS, durationSeconds: miles * secondsPerMile };
}

/** Ten ordinary runs at 9:00-9:45 /mi across August, one per day. */
function history(): RunForPace[] {
  return Array.from({ length: 10 }, (_, i) => run(`2026-08-${String(i + 1).padStart(2, "0")}`, 3, 540 + i * 5));
}

describe("detectRunningPaceRecord", () => {
  it("fires when today's run is the fastest ever over a mile", () => {
    const candidate = detectRunningPaceRecord({ runs: [...history(), run(TODAY, 5.1, 462)], today: TODAY });
    expect(candidate).not.toBeNull();
    expect(candidate?.type).toBe("personal_record");
    expect(candidate?.facts.kind).toBe("running_pace_mile");
    expect(candidate?.facts.value).toBe(462);
    expect(candidate?.facts.distanceMiles).toBe(5.1);
    expect(candidate?.dedupeKey).toBe(`personal_record:running_pace_mile:${TODAY}`);
    expect(candidate?.headline).toContain("7:42 /mi");
  });

  it("stays silent when the record is old news", () => {
    const runs = [...history(), run("2026-06-01", 4, 450)];
    expect(detectRunningPaceRecord({ runs, today: TODAY })).toBeNull();
  });

  it("needs ten plausible runs before calling anything a record", () => {
    const runs = history().slice(0, 5);
    runs.push(run(TODAY, 3, 400));
    expect(detectRunningPaceRecord({ runs, today: TODAY })).toBeNull();
  });

  it("ignores sub-mile efforts and GPS-glitch paces", () => {
    expect(isPlausibleRun(run(TODAY, 0.9, 400))).toBe(false);
    expect(isPlausibleRun(run(TODAY, 3, 150))).toBe(false);
    expect(isPlausibleRun(run(TODAY, 3, 1500))).toBe(false);
    expect(isPlausibleRun(run(TODAY, 3, 480))).toBe(true);
    // A glitch run today must not become the record either.
    const runs = [...history(), run(TODAY, 3, 120)];
    expect(detectRunningPaceRecord({ runs, today: TODAY })).toBeNull();
  });

  it("computes pace per mile from meters and seconds", () => {
    expect(Math.round(paceSecondsPerMile({ distanceMeters: 5000, durationSeconds: 1500 }))).toBe(483);
  });
});

describe("formatPace", () => {
  it("renders minutes:seconds per mile", () => {
    expect(formatPace(462)).toBe("7:42 /mi");
    expect(formatPace(600)).toBe("10:00 /mi");
    expect(formatPace(305.4)).toBe("5:05 /mi");
  });
});

describe("isBetterRecord", () => {
  it("treats lower pace as better and higher everything else as better", () => {
    expect(isBetterRecord("running_pace_mile", 450, 462)).toBe(true);
    expect(isBetterRecord("running_pace_mile", 470, 462)).toBe(false);
    expect(isBetterRecord("steps_day", 22_000, 14_000)).toBe(true);
    expect(isBetterRecord("steps_day", 14_000, 14_000)).toBe(false);
  });
});
