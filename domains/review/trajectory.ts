import type { WeeklyMetrics } from "@/domains/review/metrics";
import type { GoalTargetMetricType } from "@/domains/goals/schema";

export type TargetMetricType = GoalTargetMetricType;

/** Maps each closed-enum target metric type to the `WeeklyMetrics` field
 * it tracks. `weight_lb` maps to `averageWeightThisWeek` (an absolute
 * level, comparable to a target weight) rather than `weightChangeLb`
 * (already a week's delta, not a level a target value can be compared
 * against). Exported so `domains/goals/baseline.ts#captureGoalBaseline`
 * reuses the exact same mapping rather than redeclaring it. */
export const METRIC_FIELD: Record<TargetMetricType, keyof WeeklyMetrics> = {
  weight_lb: "averageWeightThisWeek",
  calorie_adherence_pct: "calorieAdherencePercent",
  protein_adherence_pct: "proteinAdherencePercent",
  task_completion_pct: "taskCompletionPercent",
  learning_minutes_weekly: "learningMinutes",
};

export type GoalWithTarget = {
  id: string;
  targetMetricType: TargetMetricType | null;
  targetValue: number | null;
  targetDirection: "increase" | "decrease" | null;
  targetDate: string | null;
  baselineValue: number | null;
  baselineRecordedAt: string | null;
};

export type PaceStatus = "ahead" | "on_pace" | "behind" | "insufficient_data" | "not_applicable";

export type GoalTrajectory = {
  goalId: string;
  metricType: TargetMetricType;
  currentValue: number;
  targetValue: number;
  weeksRemaining: number | null;
  projectedWeeksNeeded: number | null;
  paceStatus: PaceStatus;
  /** Calendar-date ETA derived from the latest data point + projectedWeeksNeeded
   * — null whenever projectedWeeksNeeded itself is null (insufficient data, or
   * a flat/negative rate with no honest projection to give). Never fabricated. */
  projectedCompletionDate: string | null;
};

const MIN_DATA_POINTS = 3;
const MS_PER_DAY = 86400000;
const MS_PER_WEEK = MS_PER_DAY * 7;

function weeksBetween(earlier: string, later: string): number {
  return (new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime()) / MS_PER_WEEK;
}

/** `dateIso` shifted forward by `weeks` (fractional weeks allowed), as a
 * YYYY-MM-DD string. Same UTC-based convention as `weeksBetween` above and
 * `platform/ui/week-dates.ts`'s `addDays`, so date math never drifts across
 * a DST boundary the way local-time arithmetic could. */
function addWeeks(dateIso: string, weeks: number): string {
  return new Date(new Date(`${dateIso}T00:00:00Z`).getTime() + weeks * MS_PER_WEEK).toISOString().slice(0, 10);
}

/**
 * Deterministic goal-trajectory projection (no LLM). For each goal with a
 * numeric target set (closed enum only — never a free-text/custom
 * formula, see this feature's plan doc), projects a simple linear rate of
 * change from the user's own metric history and compares it against the
 * goal's `targetDate`. Goals without a target simply get
 * `paceStatus: "not_applicable"` and no other fields computed — never
 * fabricate a projection from a goal's free-text outcome/success
 * criteria.
 */
export function computeGoalTrajectories(
  goals: GoalWithTarget[],
  history: { weekStart: string; metrics: WeeklyMetrics }[]
): GoalTrajectory[] {
  return goals
    .filter((g) => g.targetMetricType !== null && g.targetValue !== null && g.targetDirection !== null)
    .map((goal): GoalTrajectory => {
      const metricType = goal.targetMetricType as TargetMetricType;
      const field = METRIC_FIELD[metricType];
      const targetValue = goal.targetValue as number;
      const targetDirection = goal.targetDirection as "increase" | "decrease";

      const points: { at: string; value: number }[] = [];
      if (goal.baselineValue !== null && goal.baselineRecordedAt !== null) {
        points.push({ at: goal.baselineRecordedAt, value: goal.baselineValue });
      }
      for (const week of history) {
        const value = week.metrics[field];
        if (typeof value === "number") points.push({ at: week.weekStart, value });
      }
      points.sort((a, b) => a.at.localeCompare(b.at));

      if (points.length < MIN_DATA_POINTS) {
        return {
          goalId: goal.id,
          metricType,
          currentValue: points.at(-1)?.value ?? NaN,
          targetValue,
          weeksRemaining: null,
          projectedWeeksNeeded: null,
          paceStatus: "insufficient_data",
          projectedCompletionDate: null,
        };
      }

      const earliest = points[0];
      const latest = points[points.length - 1];
      const currentValue = latest.value;
      const elapsedWeeks = weeksBetween(earliest.at, latest.at);

      const alreadyThere =
        (targetDirection === "increase" && currentValue >= targetValue) ||
        (targetDirection === "decrease" && currentValue <= targetValue);
      if (alreadyThere) {
        return {
          goalId: goal.id,
          metricType,
          currentValue,
          targetValue,
          weeksRemaining: goal.targetDate ? Math.max(0, weeksBetween(latest.at, goal.targetDate)) : null,
          projectedWeeksNeeded: 0,
          paceStatus: "ahead",
          projectedCompletionDate: latest.at,
        };
      }

      if (elapsedWeeks <= 0) {
        return {
          goalId: goal.id,
          metricType,
          currentValue,
          targetValue,
          weeksRemaining: null,
          projectedWeeksNeeded: null,
          paceStatus: "insufficient_data",
          projectedCompletionDate: null,
        };
      }

      // Rate of change per week, re-signed so a positive value always
      // means "moving toward the target" regardless of whether the goal
      // is to increase or decrease the metric.
      const rawRatePerWeek = (latest.value - earliest.value) / elapsedWeeks;
      const progressRatePerWeek = targetDirection === "increase" ? rawRatePerWeek : -rawRatePerWeek;

      if (progressRatePerWeek <= 0) {
        // Trending flat or the wrong way — no honest projection to give.
        return {
          goalId: goal.id,
          metricType,
          currentValue,
          targetValue,
          weeksRemaining: goal.targetDate ? Math.max(0, weeksBetween(latest.at, goal.targetDate)) : null,
          projectedWeeksNeeded: null,
          paceStatus: "behind",
          projectedCompletionDate: null,
        };
      }

      const remainingGap = Math.abs(targetValue - currentValue);
      const projectedWeeksNeeded = Math.round((remainingGap / progressRatePerWeek) * 10) / 10;
      const projectedCompletionDate = addWeeks(latest.at, projectedWeeksNeeded);

      if (!goal.targetDate) {
        return {
          goalId: goal.id,
          metricType,
          currentValue,
          targetValue,
          weeksRemaining: null,
          projectedWeeksNeeded,
          paceStatus: "on_pace",
          projectedCompletionDate,
        };
      }

      const weeksRemaining = Math.round(weeksBetween(latest.at, goal.targetDate) * 10) / 10;
      const paceStatus: PaceStatus = projectedWeeksNeeded <= weeksRemaining ? "ahead" : "behind";

      return {
        goalId: goal.id,
        metricType,
        currentValue,
        targetValue,
        weeksRemaining,
        projectedWeeksNeeded,
        paceStatus,
        projectedCompletionDate,
      };
    });
}
