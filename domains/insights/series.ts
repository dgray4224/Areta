import type { FactSeries } from "./types";

/** Builders for the share-card series payloads (archetype cards,
 * 2026-08-15). Pure functions over data the detectors already hold in
 * memory — no extra queries.
 *
 * Two constraints shape everything here. GET /api/insights returns up to
 * 50 rows with facts inline, so series are capped and rounded to keep the
 * feed payload in the tens of KB. And the card renderers are static SVG
 * at a fixed card width, so more than ~60 marks is invisible detail. */

/** Trailing marks on a PEAK card / points on an ACCUMULATION curve. */
const MAX_POINTS = 60;
/** Day-cells on a PERSISTENCE card; 63 = 9 clean weeks, so a maxed-out
 * 60-day step streak still shows a few pre-streak cells for contrast.
 * Exported so callers can build exactly this many periods rather than
 * hardcoding a second copy of the cap. */
export const PERSISTENCE_DAY_CELLS = 63;
/** Week-cells — the workout-week streak tops out at a 12-week milestone. */
export const PERSISTENCE_WEEK_CELLS = 20;

/** Evenly-spaced sample that always keeps the first and last value.
 * Index-picking rather than averaging: the only caller is a cumulative
 * (monotonic) series, where picking preserves the true shape and
 * averaging would flatten the ends. */
function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    out.push(values[Math.round((i * (values.length - 1)) / (max - 1))]);
  }
  return out;
}

/**
 * PEAK — the trailing window with the record day marked, plus the best
 * day it beat. `previousBest` is computed over ALL history, not just the
 * window: the record is all-time, so the line it broke must be too.
 */
export function buildPeakSeries(
  history: { day: string; value: number }[],
  recordDay: string
): FactSeries | null {
  const window = history.slice(-MAX_POINTS);
  const recordIndex = window.findIndex((r) => r.day === recordDay);
  // Detectors only emit a day record when it's today or yesterday, so the
  // record is always inside the window — but a caller that changes that
  // freshness rule should get no series rather than a mismarked chart.
  if (recordIndex === -1) return null;

  let previousBest = 0;
  for (const row of history) {
    if (row.day !== recordDay && row.value > previousBest) previousBest = row.value;
  }

  return {
    kind: "peak",
    values: window.map((r) => Math.round(r.value)),
    recordIndex,
    previousBest: Math.round(previousBest),
  };
}

/**
 * ACCUMULATION — a cumulative curve from the first day with any activity
 * up to the latest, and the threshold it crossed. The dated endpoints are
 * the point of this card: "100 workouts" is a counter, "100 workouts
 * between Mar 2025 and Aug 2026" is perseverance.
 */
export function buildAccumulationSeries(
  history: { day: string; value: number }[],
  threshold: number
): FactSeries | null {
  const firstActive = history.findIndex((r) => r.value > 0);
  if (firstActive === -1) return null;

  const slice = history.slice(firstActive);
  let lastActive = slice.length - 1;
  while (lastActive > 0 && slice[lastActive].value <= 0) lastActive--;
  // A single active day is a dot, not a curve — no story to draw.
  if (lastActive < 1) return null;

  let running = 0;
  const cumulative = slice.slice(0, lastActive + 1).map((r) => (running += r.value));

  return {
    kind: "accumulation",
    points: downsample(cumulative, MAX_POINTS).map((v) => Math.round(v)),
    threshold: Math.round(threshold),
    firstDay: slice[0].day,
    lastDay: slice[lastActive].day,
  };
}

/**
 * PERSISTENCE — met/not-met cells ending at the streak's final period,
 * with whatever earlier periods fit kept so the run reads as exceptional
 * against the user's own baseline rather than floating unanchored.
 *
 * `periods` must be ascending and end at the last period OF THE STREAK
 * (not necessarily today): the step-streak detector allows an
 * as-yet-unqualifying today, and trailing it as a broken cell would read
 * as "the streak just ended".
 */
export function buildPersistenceSeries(
  periods: { met: boolean }[],
  streakLength: number,
  unit: "day" | "week"
): FactSeries | null {
  if (streakLength <= 0) return null;
  const window = periods.slice(-(unit === "week" ? PERSISTENCE_WEEK_CELLS : PERSISTENCE_DAY_CELLS));
  const streakStartIndex = window.length - streakLength;
  // The run should always fit (the streak is bounded by the same history
  // these periods come from); bail rather than draw a truncated streak.
  if (streakStartIndex < 0) return null;

  return { kind: "persistence", cells: window.map((p) => p.met), streakStartIndex, unit };
}
