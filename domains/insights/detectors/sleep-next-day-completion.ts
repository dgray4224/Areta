import { mean, median, permutationPValue, hashSeed } from "../stats";
import { addDaysToDateString, monthBucket } from "../dates";
import { sleepNextDayCompletionHeadline } from "../templates";
import type { DetectorInput, InsightCandidate } from "../types";

/** Does sleeping more than your own typical amount predict better task
 * completion the next day?
 *
 * Pairing: a sleep total on summary day D is bucketed by when the sleep
 * *started* (see domains/activity-summary/aggregate.ts), so for a typical
 * before-midnight bedtime, day D's sleep is the night leading into day
 * D+1 — it's paired with D+1's task completion. Days are split at the
 * user's own median sleep (not a universal 7h cutoff): "more than usual
 * for you" is the claim being tested, and it sidesteps arguing about what
 * the right absolute threshold is. */

const MIN_PAIRED_DAYS = 28;
const MIN_BUCKET_SIZE = 10;
const MIN_EFFECT_PP = 10;
const ALPHA = 0.05;

export function detectSleepNextDayCompletion(input: DetectorInput): InsightCandidate[] {
  const completionByDay = new Map(input.taskCompletions.map((c) => [c.day, c.completionPercent]));

  const pairs: { sleepMinutes: number; completionPercent: number }[] = [];
  for (const summary of input.summaries) {
    if (summary.sleepTotalDurationMinutes === null || summary.sleepTotalDurationMinutes <= 0) continue;
    const nextDayCompletion = completionByDay.get(addDaysToDateString(summary.day, 1));
    if (nextDayCompletion === undefined) continue;
    pairs.push({ sleepMinutes: summary.sleepTotalDurationMinutes, completionPercent: nextDayCompletion });
  }
  if (pairs.length < MIN_PAIRED_DAYS) return [];

  const threshold = median(pairs.map((p) => p.sleepMinutes));
  if (threshold === null || threshold <= 0) return [];

  // Strictly-above vs at-or-below: the claim is "more sleep than your
  // typical night", and putting median-tied days in the short bucket keeps
  // the split from degenerating when many nights share the median value
  // (coarse sleep tracking rounds durations, so exact ties are common).
  const goodNights = pairs.filter((p) => p.sleepMinutes > threshold).map((p) => p.completionPercent);
  const shortNights = pairs.filter((p) => p.sleepMinutes <= threshold).map((p) => p.completionPercent);
  if (goodNights.length < MIN_BUCKET_SIZE || shortNights.length < MIN_BUCKET_SIZE) return [];

  const goodAvg = mean(goodNights)!;
  const shortAvg = mean(shortNights)!;
  const effect = goodAvg - shortAvg;
  // Only the "more sleep helps" direction is surfaced — a negative effect
  // here is far more likely reverse causation (overwhelmed weeks wreck both
  // sleep and follow-through) than a real "sleep less, do more" finding,
  // and publishing it would be an irresponsible headline.
  if (effect < MIN_EFFECT_PP) return [];

  const p = permutationPValue(goodNights, shortNights, {
    seed: hashSeed(`${input.seedKey}:sleep_next_day_completion`),
  });
  if (p >= ALPHA) return [];

  const facts = {
    thresholdMinutes: Math.round(threshold),
    goodNightsCount: goodNights.length,
    shortNightsCount: shortNights.length,
    goodAvgCompletion: Math.round(goodAvg),
    shortAvgCompletion: Math.round(shortAvg),
    effectPp: Math.round(effect),
    pValue: Math.round(p * 1000) / 1000,
    windowDays: input.summaries.length,
  };
  const dedupeKey = `sleep_next_day_completion:${monthBucket(input.today)}`;
  return [
    {
      type: "sleep_next_day_completion",
      grain: "day",
      periodStart: input.summaries[0]?.day ?? null,
      periodEnd: input.today,
      facts,
      headline: sleepNextDayCompletionHeadline(facts, dedupeKey),
      score: Math.min(90, 45 + facts.effectPp * 2),
      dedupeKey,
    },
  ];
}
