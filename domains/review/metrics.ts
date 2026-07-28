import type { TaskStatus } from "@/domains/tasks/schema";

export type WeeklyMetricsInput = {
  weekStart: string;
  /** Weight already normalized to a single unit by the caller. */
  weightLogs: { loggedAt: string; weight: number }[];
  sleepLogs: { totalDurationMinutes: number | null }[];
  nutritionLogs: { date: string; calories: number | null; protein: number | null }[];
  recoveryLogs: { date: string; pain: number | null; swelling: number | null }[];
  studySessions: { durationMinutes: number | null }[];
  tasks: { status: TaskStatus; skipReason: string | null }[];
  calorieTarget: number | null;
  proteinTarget: number | null;
};

export type Trend = "improving" | "worsening" | "stable" | "insufficient_data";

export type WeeklyMetrics = {
  weekStart: string;
  weightChangeLb: number | null;
  averageWeightThisWeek: number | null;
  proteinAdherencePercent: number | null;
  calorieAdherencePercent: number | null;
  nutritionLoggingDays: number;
  averageSleepMinutes: number | null;
  recoveryLoggingDays: number;
  painTrend: Trend;
  swellingTrend: Trend;
  learningMinutes: number;
  taskCompletionPercent: number | null;
  missedTaskReasons: string[];
  /** True when too little was logged this week to trust adherence numbers
   * — CLAUDE.md's "data-quality issue" classification should win over
   * "adherence issue" whenever this is true. */
  isDataSparse: boolean;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Compares the first half of a series against the second half — simpler
 * and more robust to single-day noise than a full linear regression for a
 * one-week window. Lower values are treated as "improving" (fits pain and
 * swelling, the only two trends this is used for). */
function trendFromSeries(values: number[]): Trend {
  if (values.length < 2) return "insufficient_data";
  const mid = Math.ceil(values.length / 2);
  const firstHalf = average(values.slice(0, mid)) ?? 0;
  const secondHalf = average(values.slice(mid)) ?? firstHalf;
  const delta = secondHalf - firstHalf;
  const EPSILON = 0.3;
  if (delta < -EPSILON) return "improving";
  if (delta > EPSILON) return "worsening";
  return "stable";
}

/**
 * Deterministic weekly derived-metrics calculator (CLAUDE.md Phase 4
 * "Calculate" list, §7 Layer 3). Pure — takes pre-fetched log rows for the
 * week and produces the numbers the AI context builder and review UI both
 * consume. No LLM calls belong in this function.
 */
export function computeWeeklyMetrics(input: WeeklyMetricsInput): WeeklyMetrics {
  const sortedWeights = [...input.weightLogs].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );
  const weightChangeLb =
    sortedWeights.length >= 2
      ? round1(sortedWeights[sortedWeights.length - 1].weight - sortedWeights[0].weight)
      : null;
  const averageWeightThisWeek =
    sortedWeights.length > 0 ? round1(average(sortedWeights.map((w) => w.weight))!) : null;

  const nutritionLoggingDays = new Set(input.nutritionLogs.map((n) => n.date)).size;

  // Nutrition logs are per food entry (a day can have several), so daily
  // adherence needs each day's entries summed *before* averaging across
  // days — averaging raw entry values would divide by meal-count instead
  // of day-count and understate adherence.
  const caloriesByDay = new Map<string, number>();
  const proteinByDay = new Map<string, number>();
  for (const log of input.nutritionLogs) {
    if (log.calories !== null) {
      caloriesByDay.set(log.date, (caloriesByDay.get(log.date) ?? 0) + log.calories);
    }
    if (log.protein !== null) {
      proteinByDay.set(log.date, (proteinByDay.get(log.date) ?? 0) + log.protein);
    }
  }
  const avgCalories = average(Array.from(caloriesByDay.values()));
  const avgProtein = average(Array.from(proteinByDay.values()));

  const calorieAdherencePercent =
    avgCalories !== null && input.calorieTarget
      ? Math.round((avgCalories / input.calorieTarget) * 100)
      : null;
  const proteinAdherencePercent =
    avgProtein !== null && input.proteinTarget
      ? Math.round((avgProtein / input.proteinTarget) * 100)
      : null;

  const sleepDurations = input.sleepLogs
    .map((s) => s.totalDurationMinutes)
    .filter((m): m is number => m !== null);
  const averageSleepMinutes = sleepDurations.length > 0 ? Math.round(average(sleepDurations)!) : null;

  const recoveryLoggingDays = new Set(input.recoveryLogs.map((r) => r.date)).size;
  // Trend direction depends on chronological order, which the caller isn't
  // guaranteed to provide (a plain date-range query has no defined row
  // order) — sort defensively rather than trusting input order.
  const sortedRecoveryLogs = [...input.recoveryLogs].sort((a, b) => a.date.localeCompare(b.date));
  const painValues = sortedRecoveryLogs.map((r) => r.pain).filter((p): p is number => p !== null);
  const swellingValues = sortedRecoveryLogs
    .map((r) => r.swelling)
    .filter((s): s is number => s !== null);

  const learningMinutes = input.studySessions.reduce(
    (sum, s) => sum + (s.durationMinutes ?? 0),
    0
  );

  const completedTasks = input.tasks.filter(
    (t) => t.status === "completed" || t.status === "partially_completed"
  ).length;
  const taskCompletionPercent =
    input.tasks.length > 0 ? Math.round((completedTasks / input.tasks.length) * 100) : null;

  const missedTaskReasons = Array.from(
    new Set(
      input.tasks
        .filter((t) => t.status === "skipped" && t.skipReason)
        .map((t) => t.skipReason as string)
    )
  );

  const loggedDayCount = new Set([
    ...sortedWeights.map((w) => w.loggedAt.slice(0, 10)),
    ...input.sleepLogs.length > 0 ? ["sleep"] : [],
    ...input.nutritionLogs.map((n) => n.date),
    ...input.recoveryLogs.map((r) => r.date),
  ]).size;

  return {
    weekStart: input.weekStart,
    weightChangeLb,
    averageWeightThisWeek,
    proteinAdherencePercent,
    calorieAdherencePercent,
    nutritionLoggingDays,
    averageSleepMinutes,
    recoveryLoggingDays,
    painTrend: trendFromSeries(painValues),
    swellingTrend: trendFromSeries(swellingValues),
    learningMinutes,
    taskCompletionPercent,
    missedTaskReasons,
    isDataSparse: loggedDayCount < 3,
  };
}
