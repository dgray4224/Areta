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

/** A single composite adherence number for ranking weeks against each
 * other — the average of whichever of calorie/protein/task-completion
 * adherence percentages are non-null this week. Returns null if none are
 * available (a week with no relevant data can't be ranked). Deliberately
 * excludes `weightChangeLb` from this composite and from the
 * week-over-week jump comparison below: unlike the three adherence
 * percentages, a bigger weight change isn't unambiguously "better" or
 * "worse" without knowing the user's goal direction, and this module
 * must never editorialize a direction it can't actually justify. */
function compositeAdherenceScore(metrics: WeeklyMetrics): number | null {
  const values = [metrics.calorieAdherencePercent, metrics.proteinAdherencePercent, metrics.taskCompletionPercent].filter(
    (v): v is number => v !== null
  );
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
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
