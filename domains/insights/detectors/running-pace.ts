import { personalRecordHeadline } from "../templates";
import { addDaysToDateString } from "../dates";
import type { InsightCandidate } from "../types";

/** Fastest average running pace over at least a mile — a personal record
 * that lives on individual workouts rather than day summaries, which is
 * why it has its own input instead of DetectorInput.allTimeSummaries.
 *
 * Same freshness rule as the day records in personal-record.ts: fires
 * only when the record run is today or yesterday, dedupe_key pins the
 * day. Pace is stored as SECONDS per mile (an integer survives the
 * jsonb round-trip; a decimal minutes-per-mile would not format back
 * cleanly), and lower is better — which is why this record carries no
 * peak series: buildPeakSeries assumes the record is the maximum. */

export const MILE_METERS = 1609.344;
const MIN_RUNS_FOR_PACE_RECORD = 10;
// Outside this band a "run" is a GPS glitch or a mislabeled workout
// (a 2:30 mile, a 25-minute mile), not a record either way.
const MIN_PLAUSIBLE_SECONDS_PER_MILE = 180;
const MAX_PLAUSIBLE_SECONDS_PER_MILE = 1200;

export type RunForPace = {
  /** User-local day of the run's start. */
  day: string;
  distanceMeters: number;
  durationSeconds: number;
};

export function paceSecondsPerMile(run: Pick<RunForPace, "distanceMeters" | "durationSeconds">): number {
  return run.durationSeconds / (run.distanceMeters / MILE_METERS);
}

export function isPlausibleRun(run: RunForPace): boolean {
  if (run.distanceMeters < MILE_METERS || run.durationSeconds <= 0) return false;
  const pace = paceSecondsPerMile(run);
  return pace >= MIN_PLAUSIBLE_SECONDS_PER_MILE && pace <= MAX_PLAUSIBLE_SECONDS_PER_MILE;
}

export function detectRunningPaceRecord(input: { runs: RunForPace[]; today: string }): InsightCandidate | null {
  const runs = input.runs.filter(isPlausibleRun);
  if (runs.length < MIN_RUNS_FOR_PACE_RECORD) return null;

  const best = runs.reduce((a, b) => (paceSecondsPerMile(b) < paceSecondsPerMile(a) ? b : a));
  const yesterday = addDaysToDateString(input.today, -1);
  if (best.day !== input.today && best.day !== yesterday) return null;

  const value = Math.round(paceSecondsPerMile(best));
  const distanceMiles = Math.round((best.distanceMeters / MILE_METERS) * 10) / 10;
  const facts = { kind: "running_pace_mile", value, day: best.day, milestone: null, series: null, distanceMiles };
  const dedupeKey = `personal_record:running_pace_mile:${best.day}`;
  return {
    type: "personal_record",
    grain: "day",
    periodStart: best.day,
    periodEnd: best.day,
    facts,
    headline: personalRecordHeadline(facts, dedupeKey),
    score: 84,
    dedupeKey,
  };
}
