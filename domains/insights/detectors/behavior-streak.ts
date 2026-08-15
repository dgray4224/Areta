import { median } from "../stats";
import { addDaysToDateString } from "../dates";
import { behaviorStreakHeadline } from "../templates";
import { PERSISTENCE_DAY_CELLS, buildPersistenceSeries } from "../series";
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
    const anchorDay = byDay.get(input.today) && byDay.get(input.today)!.stepsTotal >= stepMedian
      ? input.today
      : addDaysToDateString(input.today, -1);
    let cursor = anchorDay;
    let streak = 0;
    while (true) {
      const day = byDay.get(cursor);
      if (!day || day.stepsTotal < stepMedian) break;
      streak++;
      cursor = addDaysToDateString(cursor, -1);
    }
    const milestone = [...STEP_STREAK_MILESTONES].reverse().find((m) => streak >= m);
    if (milestone !== undefined) {
      // Cells end at the streak's own last day, not necessarily today —
      // an as-yet-unqualifying today is allowed above, and trailing it as
      // a broken cell would read as "the streak just ended". Walked by
      // calendar day rather than over `summaries` so a gap in the data
      // shows as an unmet cell instead of silently closing the gap.
      const cells: { met: boolean }[] = [];
      let cellCursor = anchorDay;
      for (let i = 0; i < PERSISTENCE_DAY_CELLS; i++) {
        const day = byDay.get(cellCursor);
        cells.unshift({ met: !!day && day.stepsTotal >= stepMedian });
        cellCursor = addDaysToDateString(cellCursor, -1);
      }
      const series = buildPersistenceSeries(cells, streak, "day");
      const facts = { kind: "steps_above_median", length: milestone, currentStreak: streak, medianSteps: Math.round(stepMedian), series };
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
  // Every week in range is evaluated rather than stopping at the first
  // miss, so the card can show the weeks BEFORE the run for contrast.
  // The streak is then the leading run of qualifying weeks, which is
  // exactly what the earlier break-on-miss loop computed.
  const weekMet: boolean[] = []; // newest week first
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
    weekMet.push(workoutDays >= MIN_WORKOUT_DAYS_PER_WEEK);
    weekEnd = addDaysToDateString(weekStart, -1);
  }
  let workoutWeeks = 0;
  while (workoutWeeks < weekMet.length && weekMet[workoutWeeks]) workoutWeeks++;

  const weekMilestone = [...WORKOUT_WEEK_MILESTONES].reverse().find((m) => workoutWeeks >= m);
  if (weekMilestone !== undefined) {
    const series = buildPersistenceSeries(
      [...weekMet].reverse().map((met) => ({ met })),
      workoutWeeks,
      "week"
    );
    const facts = { kind: "workout_weeks", length: weekMilestone, currentStreak: workoutWeeks, series };
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
