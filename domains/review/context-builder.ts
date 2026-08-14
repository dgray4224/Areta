import type { WeeklyMetrics } from "@/domains/review/metrics";
import { MOTIVATION_QUOTES } from "@/domains/motivation/quotes";
import type { CorrelationFinding } from "@/domains/review/correlations";
import type { AchievementFacts } from "@/domains/review/achievements";
import type { GoalTrajectory } from "@/domains/review/trajectory";
import type { StreakFacts } from "@/domains/review/streaks";
import type { ExperimentOutcome } from "@/domains/review/experiments";

export type WeeklyReviewContext = {
  weekStart: string;
  currentPhase: { name: string; mission: string | null } | null;
  activeGoals: {
    id: string;
    outcome: string;
    domain: string;
    targetDate: string | null;
    priority: number | null;
  }[];
  metrics: WeeklyMetrics;
  nutritionTargets: {
    calorieTarget: number | null;
    proteinTarget: number | null;
    expectedWeeklyRateLb: number | null;
  } | null;
  recentMemories: { type: string; content: string; evidence: string | null }[];
  previousWeekPriorities: string[];
  /** This user's own metrics history (excluding the current week),
   * most-recent-first — CLAUDE.md §9's "relevant historical comparison"
   * was in the original weekly-context spec but never actually passed
   * until now (only priority titles were). Lets the model make real
   * cross-week callbacks ("3rd week in a row X happened") instead of
   * only ever seeing one week at a time. */
  weeklyMetricsHistory: { weekStart: string; metrics: WeeklyMetrics }[];
  correlationFindings: CorrelationFinding[];
  achievements: AchievementFacts;
  goalTrajectories: GoalTrajectory[];
  streaks: StreakFacts;
  experimentOutcomes: ExperimentOutcome[];
  /** This week's Insight Engine v2 findings (domains/insights/, Phase 3
   * 2026-08-14) — day-grain records/streaks/patterns the detector battery
   * already validated and phrased. Ground truth like everything else
   * here: the model may weave them into the narrative but never restate
   * their numbers differently or invent new ones. */
  recentInsights: { type: string; headline: string }[];
  /** This week's answers to the lightweight interview step (mobile-only
   * for now), keyed by question id — see review-screens/InterviewStep on
   * the mobile side. Empty object if none answered yet. */
  interviewAnswers: Record<string, string>;
  motivationQuoteBank: { id: string; quote: string; author: string; themes: string[] }[];
};

/**
 * Weekly AI context builder (CLAUDE.md §9). Assembles only the compact,
 * purpose-built fields the weekly-brief prompt needs — never the full
 * database — so what actually reaches the model stays small and legible.
 * `motivationQuoteBank` is always the same curated constant, not
 * user-specific, so callers don't supply it — it's injected here.
 */
export function buildWeeklyReviewContext(
  input: Omit<WeeklyReviewContext, "motivationQuoteBank">
): WeeklyReviewContext {
  return { ...input, motivationQuoteBank: MOTIVATION_QUOTES };
}
