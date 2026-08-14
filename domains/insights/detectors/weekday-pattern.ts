import { mean, permutationPValue, hashSeed } from "../stats";
import { monthBucket, weekdaySlug } from "../dates";
import { weekdayPatternHeadline } from "../templates";
import type { DetectorInput, InsightCandidate } from "../types";

/** "Your Tuesday problem" — is one weekday reliably different from the
 * rest of the week for task completion?
 *
 * This detector scans 7 hypotheses (one per weekday), so its alpha is
 * Bonferroni-corrected by hand: a weekday only fires at p < 0.05/7. Days
 * come from daily_actions (any day with >=1 task), weekday derived from
 * the date string itself (UTC parse of a local calendar date is safe —
 * the date string is already in the user's local calendar). */

const MIN_WEEKDAY_OCCURRENCES = 6;
const MIN_TOTAL_DAYS = 30;
const MIN_EFFECT_PP = 15;
const ALPHA = 0.05 / 7;

export function detectWeekdayPattern(input: DetectorInput): InsightCandidate[] {
  if (input.taskCompletions.length < MIN_TOTAL_DAYS) return [];

  const byWeekday = new Map<number, number[]>();
  for (const c of input.taskCompletions) {
    const weekday = new Date(`${c.day}T00:00:00Z`).getUTCDay();
    const bucket = byWeekday.get(weekday) ?? [];
    bucket.push(c.completionPercent);
    byWeekday.set(weekday, bucket);
  }

  let best: { dayOfWeek: number; weekdayValues: number[]; otherValues: number[]; effect: number } | null = null;
  for (const [dayOfWeek, weekdayValues] of byWeekday) {
    if (weekdayValues.length < MIN_WEEKDAY_OCCURRENCES) continue;
    const otherValues = input.taskCompletions
      .filter((c) => new Date(`${c.day}T00:00:00Z`).getUTCDay() !== dayOfWeek)
      .map((c) => c.completionPercent);
    if (otherValues.length === 0) continue;
    const effect = (mean(weekdayValues) ?? 0) - (mean(otherValues) ?? 0);
    if (Math.abs(effect) < MIN_EFFECT_PP) continue;
    if (!best || Math.abs(effect) > Math.abs(best.effect)) {
      best = { dayOfWeek, weekdayValues, otherValues, effect };
    }
  }
  if (!best) return [];

  const p = permutationPValue(best.weekdayValues, best.otherValues, {
    seed: hashSeed(`${input.seedKey}:weekday_pattern:${best.dayOfWeek}`),
  });
  if (p >= ALPHA) return [];

  const facts = {
    dayOfWeek: best.dayOfWeek,
    weekdayAvg: Math.round(mean(best.weekdayValues)!),
    othersAvg: Math.round(mean(best.otherValues)!),
    effectPp: Math.round(Math.abs(best.effect)),
    direction: best.effect < 0 ? "worse" : "better",
    occurrences: best.weekdayValues.length,
    pValue: Math.round(p * 1000) / 1000,
    windowDays: input.taskCompletions.length,
  };
  const dedupeKey = `weekday_pattern:${weekdaySlug(best.dayOfWeek)}:${monthBucket(input.today)}`;
  return [
    {
      type: "weekday_pattern",
      grain: "day",
      periodStart: input.taskCompletions[0]?.day ?? null,
      periodEnd: input.today,
      facts,
      headline: weekdayPatternHeadline(facts, dedupeKey),
      score: Math.min(88, 45 + facts.effectPp * 1.5),
      dedupeKey,
    },
  ];
}
