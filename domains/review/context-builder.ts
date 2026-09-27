import type { WeeklyMetrics } from "@/domains/review/metrics";
import { MOTIVATION_QUOTES } from "@/domains/motivation/quotes";
import type { CorrelationFinding } from "@/domains/review/correlations";
import type { AchievementFacts } from "@/domains/review/achievements";
import type { GoalTrajectory } from "@/domains/review/trajectory";
import type { StreakFacts } from "@/domains/review/streaks";
import type { ExperimentOutcome } from "@/domains/review/experiments";
import type { PlanExecutionFacts } from "@/domains/review/plan-execution";
import type { TrainingBaseline } from "@/domains/review/training-baseline";

/** Above this share of intake inferred from the plan, calorie and protein
 * adherence describe the plan rather than the person. */
const MAX_ASSUMED_INTAKE_PERCENT = 50;

const HIDDEN_FROM_BRIEF = [
  "workoutsAutoCompleted",
  "mealsConfirmed",
  "mealsAssumed",
  "assumedIntakeSharePercent",
  "nutritionLoggingDays",
  "recoveryLoggingDays",
] as const;

/**
 * Metrics as the model sees them. Everything about how data reached the
 * app (auto-completed vs ticked, assumed vs confirmed meals, logging-day
 * counts) is removed: the brief kept narrating app mechanics however the
 * prompt forbade it, so the facts it must not talk about aren't sent.
 * When intake is mostly assumed, the calorie/protein percentages are
 * withheld too — they describe the plan, not the person — and
 * `intakeVisible: false` says only that.
 */
export type BriefMetrics = Omit<WeeklyMetrics, (typeof HIDDEN_FROM_BRIEF)[number]> & { intakeVisible: boolean };

export function toBriefMetrics(metrics: WeeklyMetrics): BriefMetrics {
  const intakeVisible = (metrics.assumedIntakeSharePercent ?? 0) <= MAX_ASSUMED_INTAKE_PERCENT;
  const visible: Partial<WeeklyMetrics> = { ...metrics };
  for (const key of HIDDEN_FROM_BRIEF) delete visible[key];
  return {
    ...(visible as Omit<WeeklyMetrics, (typeof HIDDEN_FROM_BRIEF)[number]>),
    calorieAdherencePercent: intakeVisible ? metrics.calorieAdherencePercent : null,
    proteinAdherencePercent: intakeVisible ? metrics.proteinAdherencePercent : null,
    intakeVisible,
  };
}

export type WeeklyReviewContextInput = {
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
  /** How many weeks in a row the training plan has gone unexecuted, and
   * whether that has run long enough to justify changing the plan
   * (domains/review/plan-execution.ts). The plan is the person's
   * commitment; the model may not propose cutting it before this says so. */
  planExecution: PlanExecutionFacts;
  /** A year of their own training from imported history — the yardstick
   * for this week, and proof of what they have already done
   * (domains/review/training-baseline.ts). */
  trainingBaseline: TrainingBaseline;
  /** What last Sunday's brief said, so this one doesn't repeat it. */
  lastWeeksBrief: { narrative: string[]; highestLeverageAction: string } | null;
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
};

/** What reaches the model: metrics filtered through toBriefMetrics, and
 * logging streaks dropped (they measure app use, not the person's week). */
export type WeeklyReviewContext = Omit<
  WeeklyReviewContextInput,
  "metrics" | "weeklyMetricsHistory" | "streaks" | "achievements"
> & {
  metrics: BriefMetrics;
  weeklyMetricsHistory: { weekStart: string; metrics: BriefMetrics }[];
  achievements: Omit<AchievementFacts, "streaks">;
  motivationQuoteBank: { id: string; quote: string; author: string; themes: string[] }[];
};

/**
 * Weekly AI context builder (CLAUDE.md §9). Assembles only the compact,
 * purpose-built fields the weekly-brief prompt needs — never the full
 * database — so what actually reaches the model stays small and legible.
 * `motivationQuoteBank` is always the same curated constant, not
 * user-specific, so callers don't supply it — it's injected here.
 */
export function buildWeeklyReviewContext(input: WeeklyReviewContextInput): WeeklyReviewContext {
  const { achievements, metrics, weeklyMetricsHistory, ...rest } = input;
  const achievementsWithoutStreaks: Partial<AchievementFacts> = { ...achievements };
  delete achievementsWithoutStreaks.streaks;
  const withoutStreaks: Partial<typeof rest> = { ...rest };
  delete withoutStreaks.streaks;
  return {
    ...(withoutStreaks as Omit<typeof rest, "streaks">),
    metrics: toBriefMetrics(metrics),
    weeklyMetricsHistory: weeklyMetricsHistory.map((h) => ({ weekStart: h.weekStart, metrics: toBriefMetrics(h.metrics) })),
    achievements: achievementsWithoutStreaks as Omit<AchievementFacts, "streaks">,
    motivationQuoteBank: MOTIVATION_QUOTES,
  };
}
