import { mean, permutationPValue, hashSeed } from "../stats";
import { monthBucket } from "../dates";
import { weekendShiftHeadline } from "../templates";
import type { DetectorInput, InsightCandidate } from "../types";

/** How different is weekend-you from weekday-you? Tests sleep minutes and
 * daily steps separately (each with its own effect floor) and surfaces at
 * most one — the stronger passing contrast. is_weekend is already a
 * column on activity_daily_summaries; rows where it's null (shouldn't
 * happen, but the column is nullable) are skipped. */

const MIN_WEEKEND_DAYS = 8;
const MIN_WEEKDAY_DAYS = 15;
const MIN_SLEEP_EFFECT_MINUTES = 30;
const MIN_STEPS_EFFECT_RELATIVE = 0.2; // 20% of the weekday average
const ALPHA = 0.05;

export function detectWeekendShift(input: DetectorInput): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];

  const sleepWeekend: number[] = [];
  const sleepWeekday: number[] = [];
  const stepsWeekend: number[] = [];
  const stepsWeekday: number[] = [];
  for (const s of input.summaries) {
    if (s.isWeekend === null) continue;
    if (s.sleepTotalDurationMinutes !== null && s.sleepTotalDurationMinutes > 0) {
      (s.isWeekend ? sleepWeekend : sleepWeekday).push(s.sleepTotalDurationMinutes);
    }
    if (s.stepsTotal > 0) {
      (s.isWeekend ? stepsWeekend : stepsWeekday).push(s.stepsTotal);
    }
  }

  const evaluate = (
    metric: "sleep" | "steps",
    weekend: number[],
    weekday: number[],
    passesEffectFloor: (effect: number, weekdayAvg: number) => boolean
  ) => {
    if (weekend.length < MIN_WEEKEND_DAYS || weekday.length < MIN_WEEKDAY_DAYS) return;
    const weekendAvg = mean(weekend)!;
    const weekdayAvg = mean(weekday)!;
    const effect = weekendAvg - weekdayAvg;
    if (!passesEffectFloor(Math.abs(effect), weekdayAvg)) return;
    const p = permutationPValue(weekend, weekday, {
      seed: hashSeed(`${input.seedKey}:weekend_shift:${metric}`),
    });
    if (p >= ALPHA) return;

    const facts = {
      metric,
      weekendAvg: Math.round(weekendAvg),
      weekdayAvg: Math.round(weekdayAvg),
      effect: Math.round(effect),
      weekendDays: weekend.length,
      weekdayDays: weekday.length,
      pValue: Math.round(p * 1000) / 1000,
      windowDays: input.summaries.length,
    };
    const dedupeKey = `weekend_shift:${metric}:${monthBucket(input.today)}`;
    // Score scales with how large the shift is relative to its floor, so a
    // barely-passing finding ranks below a dramatic one.
    const floor = metric === "sleep" ? MIN_SLEEP_EFFECT_MINUTES : weekdayAvg * MIN_STEPS_EFFECT_RELATIVE;
    candidates.push({
      type: "weekend_shift",
      grain: "day",
      periodStart: input.summaries[0]?.day ?? null,
      periodEnd: input.today,
      facts,
      headline: weekendShiftHeadline(facts, dedupeKey),
      score: Math.min(80, 40 + 20 * Math.min(2, Math.abs(effect) / floor)),
      dedupeKey,
    });
  };

  evaluate("sleep", sleepWeekend, sleepWeekday, (effect) => effect >= MIN_SLEEP_EFFECT_MINUTES);
  evaluate("steps", stepsWeekend, stepsWeekday, (effect, weekdayAvg) => effect >= weekdayAvg * MIN_STEPS_EFFECT_RELATIVE);

  // At most one weekend-shift insight per run — the stronger one.
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 1);
}
