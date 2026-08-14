import { mean, permutationPValue, hashSeed } from "../stats";
import { monthBucket } from "../dates";
import { workoutTimingSleepHeadline } from "../templates";
import type { DetectorInput, InsightCandidate } from "../types";

/** Do morning workouts and evening workouts lead to different sleep that
 * night?
 *
 * Buckets: first workout starting before noon = "morning", at/after 5pm =
 * "evening"; midday sessions are excluded to keep the contrast honest.
 * Sleep attribution: a summary day's sleep total is bucketed by sleep
 * *start* day, so for typical before-midnight bedtimes, day D's sleep IS
 * the night following day D's workout. After-midnight bedtimes blur this —
 * that attribution noise dilutes a real effect rather than manufacturing a
 * fake one, which is the failure direction we can live with. */

const MORNING_MAX_HOUR = 12; // exclusive
const EVENING_MIN_HOUR = 17; // inclusive
const MIN_BUCKET_SIZE = 8;
const MIN_EFFECT_MINUTES = 20;
const ALPHA = 0.05;

export function detectWorkoutTimingSleep(input: DetectorInput): InsightCandidate[] {
  const morning: number[] = [];
  const evening: number[] = [];
  for (const s of input.summaries) {
    if (s.workoutCount === 0 || s.workoutFirstStartLocalHour === null) continue;
    if (s.sleepTotalDurationMinutes === null || s.sleepTotalDurationMinutes <= 0) continue;
    if (s.workoutFirstStartLocalHour < MORNING_MAX_HOUR) morning.push(s.sleepTotalDurationMinutes);
    else if (s.workoutFirstStartLocalHour >= EVENING_MIN_HOUR) evening.push(s.sleepTotalDurationMinutes);
  }
  if (morning.length < MIN_BUCKET_SIZE || evening.length < MIN_BUCKET_SIZE) return [];

  const morningAvg = mean(morning)!;
  const eveningAvg = mean(evening)!;
  const effect = Math.abs(morningAvg - eveningAvg);
  if (effect < MIN_EFFECT_MINUTES) return [];

  const p = permutationPValue(morning, evening, {
    seed: hashSeed(`${input.seedKey}:workout_timing_sleep`),
  });
  if (p >= ALPHA) return [];

  const facts = {
    morningCount: morning.length,
    eveningCount: evening.length,
    morningAvgSleep: Math.round(morningAvg),
    eveningAvgSleep: Math.round(eveningAvg),
    effectMinutes: Math.round(effect),
    betterBucket: morningAvg > eveningAvg ? "morning" : "evening",
    pValue: Math.round(p * 1000) / 1000,
    windowDays: input.summaries.length,
  };
  const dedupeKey = `workout_timing_sleep:${monthBucket(input.today)}`;
  return [
    {
      type: "workout_timing_sleep",
      grain: "day",
      periodStart: input.summaries[0]?.day ?? null,
      periodEnd: input.today,
      facts,
      headline: workoutTimingSleepHeadline(facts, dedupeKey),
      score: Math.min(85, 45 + facts.effectMinutes),
      dedupeKey,
    },
  ];
}
