import type { WeeklyMetrics } from "@/domains/review/metrics";
import type { StreakFacts } from "@/domains/review/streaks";

export type AchievementFacts = {
  isPersonalBestAdherenceWeek: boolean;
  personalBestAdherenceScore: number | null;
  personalBestWeekStart: string | null;
  biggestWeekOverWeekJump: {
    metric: "taskCompletionPercent" | "adherenceScore";
    delta: number;
    direction: "improvement" | "decline";
  } | null;
  streaks: StreakFacts;
};

/** Above this share of intake inferred from the plan, calorie and protein
 * adherence describe the plan rather than the person, so they stay out of
 * the composite. */
const MAX_ASSUMED_INTAKE_PERCENT = 50;

/** A single composite adherence number for ranking weeks against each
 * other — the average of whichever of calorie/protein/workout/task
 * adherence percentages are non-null and trustworthy this week. Returns
 * null if none are (a week with no relevant data can't be ranked).
 *
 * Calorie and protein are dropped when most intake was assumed: a week
 * where every meal was inferred from the plan otherwise scored as a
 * "personal best" on numbers the person never reported (2026-09-27).
 * Workouts were missing entirely until then, so the headline adherence
 * figure ignored the one thing measured from the watch.
 *
 * Deliberately excludes `weightChangeLb` from this composite and from the
 * week-over-week jump comparison below: unlike the adherence
 * percentages, a bigger weight change isn't unambiguously "better" or
 * "worse" without knowing the user's goal direction, and this module
 * must never editorialize a direction it can't actually justify. */
function compositeAdherenceScore(metrics: WeeklyMetrics): number | null {
  // `?? null` because rows stored before these fields existed lack them.
  const intakeTrusted = (metrics.assumedIntakeSharePercent ?? 0) <= MAX_ASSUMED_INTAKE_PERCENT;
  const values = [
    intakeTrusted ? metrics.calorieAdherencePercent : null,
    intakeTrusted ? metrics.proteinAdherencePercent : null,
    metrics.workoutAdherencePercent ?? null,
    metrics.taskCompletionPercent,
  ].filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** The history entry covering the week right before `current`, or null
 * when that week has no review. Reviews can skip weeks, and comparing
 * against whatever came last reported a mid-August week as "the week
 * before". `history` is most-recent-first. */
export function immediatelyPreviousWeek(
  current: WeeklyMetrics,
  history: { metrics: WeeklyMetrics }[]
): WeeklyMetrics | null {
  const latest = history[0]?.metrics;
  if (!latest) return null;
  const gapDays = (Date.parse(`${current.weekStart}T00:00:00Z`) - Date.parse(`${latest.weekStart}T00:00:00Z`)) / 86_400_000;
  return gapDays === 7 ? latest : null;
}

/**
 * Deterministic self-referential achievement ranking (no LLM). Compares
 * the current week only against this user's own history — never other
 * users — per the decided "self-referential achievement framing" scope.
 * `history` should be the user's past weekly_reviews rows, most-recent
 * first is not required (this function doesn't depend on order except
 * for `previousWeek`, which callers must pass explicitly as the
 * immediately preceding week's metrics).
 */
export function computeAchievements(
  current: WeeklyMetrics,
  history: { weekStart: string; metrics: WeeklyMetrics }[],
  previousWeek: WeeklyMetrics | null,
  streaks: StreakFacts
): AchievementFacts {
  const currentScore = compositeAdherenceScore(current);

  let personalBestAdherenceScore: number | null = currentScore;
  let personalBestWeekStart: string | null = currentScore !== null ? current.weekStart : null;
  for (const week of history) {
    const score = compositeAdherenceScore(week.metrics);
    if (score !== null && (personalBestAdherenceScore === null || score > personalBestAdherenceScore)) {
      personalBestAdherenceScore = score;
      personalBestWeekStart = week.weekStart;
    }
  }
  const isPersonalBestAdherenceWeek =
    currentScore !== null && personalBestWeekStart === current.weekStart;

  let biggestWeekOverWeekJump: AchievementFacts["biggestWeekOverWeekJump"] = null;
  if (previousWeek) {
    const candidates: { metric: "taskCompletionPercent" | "adherenceScore"; delta: number }[] = [];
    if (current.taskCompletionPercent !== null && previousWeek.taskCompletionPercent !== null) {
      candidates.push({
        metric: "taskCompletionPercent",
        delta: current.taskCompletionPercent - previousWeek.taskCompletionPercent,
      });
    }
    const prevScore = compositeAdherenceScore(previousWeek);
    if (currentScore !== null && prevScore !== null) {
      candidates.push({ metric: "adherenceScore", delta: currentScore - prevScore });
    }
    if (candidates.length > 0) {
      const biggest = candidates.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
      biggestWeekOverWeekJump = {
        metric: biggest.metric,
        delta: biggest.delta,
        direction: biggest.delta >= 0 ? "improvement" : "decline",
      };
    }
  }

  return {
    isPersonalBestAdherenceWeek,
    personalBestAdherenceScore,
    personalBestWeekStart,
    biggestWeekOverWeekJump,
    streaks,
  };
}
