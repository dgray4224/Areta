import { median } from "../stats";
import { addDaysToDateString } from "../dates";
import { behaviorStreakHeadline } from "../templates";
import type { DetectorInput, InsightCandidate } from "../types";

/** Day-grain behavioral streaks — deterministic, milestone-gated so a
 * growing streak doesn't fire daily (a 6-day streak is silent; 5, 7, 10,
 * 14... each fire exactly once via their dedupe keys).
 *
 * Two kinds:
 * - steps_above_median: consecutive days at/above the user's own median
 *   daily steps (window-median, so "your typical day" adapts as they do).
 * - workout_weeks: consecutive rolling 7-day weeks (ending today) with
 *   >= 2 workout days — same rolling-week convention as
 *   domains/review/streaks.ts's currentAllTasksCompleteWeeks. */

const STEP_STREAK_MILESTONES = [5, 7, 10, 14, 21, 30, 45, 60];
const WORKOUT_WEEK_MILESTONES = [3, 4, 6, 8, 12];
const MIN_WORKOUT_DAYS_PER_WEEK = 2;

export function detectBehaviorStreaks(input: DetectorInput): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const byDay = new Map(input.summaries.map((s) => [s.day, s]));

  // --- Steps above personal median ------------------------------------
  const stepValues = input.summaries.map((s) => s.stepsTotal).filter((v) => v > 0);
  const stepMedian = median(stepValues);
  if (stepMedian !== null && stepMedian > 0) {
    // Same "today hasn't ended yet" allowance as streaks.ts's
    // currentStreak: an incomplete today doesn't zero a live streak.
    let cursor = byDay.get(input.today) && byDay.get(input.today)!.stepsTotal >= stepMedian
      ? input.today
      : addDaysToDateString(input.today, -1);
    let streak = 0;
    while (true) {
      const day = byDay.get(cursor);
      if (!day || day.stepsTotal < stepMedian) break;
      streak++;
      cursor = addDaysToDateString(cursor, -1);
    }
    const milestone = [...STEP_STREAK_MILESTONES].reverse().find((m) => streak >= m);
    if (milestone !== undefined) {
      const facts = { kind: "steps_above_median", length: milestone, currentStreak: streak, medianSteps: Math.round(stepMedian) };
      const dedupeKey = `behavior_streak:steps_above_median:${milestone}`;
      candidates.push({
        type: "behavior_streak",
        grain: "day",
        periodStart: addDaysToDateString(input.today, -(streak - 1)),
        periodEnd: input.today,
        facts,
        headline: behaviorStreakHeadline(facts, dedupeKey),
        score: Math.min(78, 55 + milestone),
        dedupeKey,
      });
    }
  }

  // --- Consecutive workout weeks --------------------------------------
  let workoutWeeks = 0;
  let weekEnd = input.today;
  const maxWeeks = Math.floor(input.summaries.length / 7);
  for (let i = 0; i < maxWeeks; i++) {
    const weekStart = addDaysToDateString(weekEnd, -6);
    let workoutDays = 0;
    let cursor = weekStart;
    while (cursor <= weekEnd) {
      const day = byDay.get(cursor);
      if (day && day.workoutCount > 0) workoutDays++;
      cursor = addDaysToDateString(cursor, 1);
    }
    if (workoutDays < MIN_WORKOUT_DAYS_PER_WEEK) break;
    workoutWeeks++;
    weekEnd = addDaysToDateString(weekStart, -1);
  }
  const weekMilestone = [...WORKOUT_WEEK_MILESTONES].reverse().find((m) => workoutWeeks >= m);
  if (weekMilestone !== undefined) {
    const facts = { kind: "workout_weeks", length: weekMilestone, currentStreak: workoutWeeks };
    const dedupeKey = `behavior_streak:workout_weeks:${weekMilestone}`;
    candidates.push({
      type: "behavior_streak",
      grain: "week",
      periodStart: addDaysToDateString(input.today, -(weekMilestone * 7 - 1)),
      periodEnd: input.today,
      facts,
      headline: behaviorStreakHeadline(facts, dedupeKey),
      score: Math.min(80, 58 + weekMilestone * 2),
      dedupeKey,
    });
  }

  return candidates;
}
