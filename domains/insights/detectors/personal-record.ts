import { personalRecordHeadline } from "../templates";
import { addDaysToDateString } from "../dates";
import { buildAccumulationSeries, buildPeakSeries } from "../series";
import type { DetectorInput, InsightCandidate } from "../types";

/** Personal records and cumulative milestones — fully deterministic, no
 * statistics needed. The only guard is data sufficiency: no "record" is
 * declared until there's enough history that beating it means something.
 *
 * Freshness rule: a day record only fires if the record day is today or
 * yesterday — the daily cron sees each new record exactly once, close to
 * when it happened (dedupe_key pins the specific day, so re-runs are
 * no-ops). Milestones fire whenever the lifetime total has crossed a
 * threshold that hasn't fired before (dedupe_key pins the threshold), so
 * a missed cron day can't permanently swallow one. */

const MIN_HISTORY_DAYS_FOR_DAY_RECORD = 30;
const MIN_WORKOUT_DAYS_FOR_RECORD = 10;
// Exported so the historical-achievement backfill emits exactly the same
// ladder (and therefore the same dedupe_keys) as the live detector — a
// second copy of these numbers would silently double-insert on drift.
export const WORKOUT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
export const STEP_MILESTONES = [1_000_000, 2_000_000, 5_000_000, 10_000_000];

export function detectPersonalRecords(input: DetectorInput): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const all = input.allTimeSummaries;
  if (all.length === 0) return [];
  const yesterday = addDaysToDateString(input.today, -1);
  const isFresh = (day: string) => day === input.today || day === yesterday;

  // --- Day records ---------------------------------------------------
  const stepDays = all.filter((s) => s.stepsTotal > 0);
  if (stepDays.length >= MIN_HISTORY_DAYS_FOR_DAY_RECORD) {
    const recordDay = stepDays.reduce((best, s) => (s.stepsTotal > best.stepsTotal ? s : best));
    if (isFresh(recordDay.day)) {
      const series = buildPeakSeries(
        all.map((s) => ({ day: s.day, value: s.stepsTotal })),
        recordDay.day
      );
      const facts = { kind: "steps_day", value: recordDay.stepsTotal, day: recordDay.day, milestone: null, series };
      const dedupeKey = `personal_record:steps_day:${recordDay.day}`;
      candidates.push({
        type: "personal_record",
        grain: "day",
        periodStart: recordDay.day,
        periodEnd: recordDay.day,
        facts,
        headline: personalRecordHeadline(facts, dedupeKey),
        score: 82,
        dedupeKey,
      });
    }
  }

  const workoutDays = all.filter((s) => s.workoutTotalMinutes > 0);
  if (workoutDays.length >= MIN_WORKOUT_DAYS_FOR_RECORD) {
    const recordDay = workoutDays.reduce((best, s) => (s.workoutTotalMinutes > best.workoutTotalMinutes ? s : best));
    if (isFresh(recordDay.day)) {
      const series = buildPeakSeries(
        all.map((s) => ({ day: s.day, value: s.workoutTotalMinutes })),
        recordDay.day
      );
      const facts = { kind: "workout_minutes_day", value: recordDay.workoutTotalMinutes, day: recordDay.day, milestone: null, series };
      const dedupeKey = `personal_record:workout_minutes_day:${recordDay.day}`;
      candidates.push({
        type: "personal_record",
        grain: "day",
        periodStart: recordDay.day,
        periodEnd: recordDay.day,
        facts,
        headline: personalRecordHeadline(facts, dedupeKey),
        score: 80,
        dedupeKey,
      });
    }
  }

  // --- Cumulative milestones -----------------------------------------
  const totalWorkouts = all.reduce((sum, s) => sum + s.workoutCount, 0);
  const workoutMilestone = [...WORKOUT_MILESTONES].reverse().find((m) => totalWorkouts >= m);
  if (workoutMilestone !== undefined) {
    const series = buildAccumulationSeries(
      all.map((s) => ({ day: s.day, value: s.workoutCount })),
      workoutMilestone
    );
    const facts = { kind: "workout_milestone", value: totalWorkouts, day: null, milestone: workoutMilestone, series };
    const dedupeKey = `personal_record:workout_milestone:${workoutMilestone}`;
    candidates.push({
      type: "personal_record",
      grain: "lifetime",
      periodStart: all[0]?.day ?? null,
      periodEnd: input.today,
      facts,
      headline: personalRecordHeadline(facts, dedupeKey),
      score: 86,
      dedupeKey,
    });
  }

  const totalSteps = all.reduce((sum, s) => sum + s.stepsTotal, 0);
  const stepMilestone = [...STEP_MILESTONES].reverse().find((m) => totalSteps >= m);
  if (stepMilestone !== undefined) {
    const series = buildAccumulationSeries(
      all.map((s) => ({ day: s.day, value: s.stepsTotal })),
      stepMilestone
    );
    const facts = { kind: "steps_milestone", value: totalSteps, day: null, milestone: stepMilestone, series };
    const dedupeKey = `personal_record:steps_milestone:${stepMilestone}`;
    candidates.push({
      type: "personal_record",
      grain: "lifetime",
      periodStart: all[0]?.day ?? null,
      periodEnd: input.today,
      facts,
      headline: personalRecordHeadline(facts, dedupeKey),
      score: 84,
      dedupeKey,
    });
  }

  return candidates;
}
