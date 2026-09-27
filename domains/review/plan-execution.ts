import type { WeeklyMetrics } from "@/domains/review/metrics";

/**
 * How long the person has gone without executing their training plan.
 *
 * The plan is the person's own commitment, made when they set their goals,
 * so a missed week is an execution problem to own — not evidence the plan
 * is wrong. Only a sustained run of missed weeks earns a suggestion to
 * change the plan itself. Computed here rather than judged by the model so
 * one bad week can never talk the brief into cutting the plan.
 */

/** A week counts as executed at or above this share of planned sessions. */
export const PLAN_EXECUTED_PERCENT = 80;
/** Consecutive missed weeks (~a month) before the brief may propose a lighter plan. */
export const MISSED_WEEKS_BEFORE_REPLAN = 4;

export type PlanExecutionFacts = {
  /** Consecutive weeks, ending with this one, where the plan was missed. */
  missedWeeksInARow: number;
  executedThresholdPercent: number;
  missedWeeksBeforeReplan: number;
  /** True only once missedWeeksInARow reaches the threshold. */
  planChangeWarranted: boolean;
};

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

/**
 * @param weeks most-recent-first, current week included. A skipped week
 * (no review row) or a week with nothing planned ends the run: unknown is
 * not the same as missed.
 */
export function computePlanExecution(weeks: { weekStart: string; metrics: WeeklyMetrics }[]): PlanExecutionFacts {
  let missedWeeksInARow = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (i > 0 && daysBetween(weeks[i - 1].weekStart, weeks[i].weekStart) !== 7) break;
    const { workoutsPlanned, workoutAdherencePercent } = weeks[i].metrics;
    if (!workoutsPlanned || workoutAdherencePercent === null) break;
    if (workoutAdherencePercent >= PLAN_EXECUTED_PERCENT) break;
    missedWeeksInARow++;
  }
  return {
    missedWeeksInARow,
    executedThresholdPercent: PLAN_EXECUTED_PERCENT,
    missedWeeksBeforeReplan: MISSED_WEEKS_BEFORE_REPLAN,
    planChangeWarranted: missedWeeksInARow >= MISSED_WEEKS_BEFORE_REPLAN,
  };
}
