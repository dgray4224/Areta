import type { WeeklyMetrics } from "@/domains/review/metrics";

export const EXPECTED_METRIC_KEYS = [
  "weightChangeLb",
  "averageWeightThisWeek",
  "proteinAdherencePercent",
  "calorieAdherencePercent",
  "averageSleepMinutes",
  "taskCompletionPercent",
  "learningMinutes",
  "averagePainThisWeek",
  "averageSwellingThisWeek",
] as const;
export type ExpectedMetricKey = (typeof EXPECTED_METRIC_KEYS)[number];

export type ExpectedDirection = "increase" | "decrease" | "improve" | "stabilize";

export type OutcomeClassification = "helpful" | "neutral" | "harmful" | "unknown";

export type EvaluableRecommendation = {
  id: string;
  field: string;
  accepted: boolean | null;
  expectedMetric: ExpectedMetricKey | null;
  expectedDirection: ExpectedDirection | null;
};

export type ExperimentOutcome = {
  recommendationId: string;
  field: string;
  expectedMetric: ExpectedMetricKey;
  expectedDirection: ExpectedDirection;
  before: number | null;
  after: number | null;
  delta: number | null;
  classification: OutcomeClassification;
};

/** How much a metric has to move before it counts as a real change rather
 * than noise — scaled per metric's own units (percentage points, pounds,
 * minutes, or the recovery domain's small numeric scale). */
const EPSILON: Record<ExpectedMetricKey, number> = {
  weightChangeLb: 1,
  averageWeightThisWeek: 1,
  proteinAdherencePercent: 3,
  calorieAdherencePercent: 3,
  averageSleepMinutes: 15,
  taskCompletionPercent: 3,
  learningMinutes: 20,
  averagePainThisWeek: 0.5,
  averageSwellingThisWeek: 0.5,
};

/** Whether a higher value is unambiguously "better" for this metric —
 * used only to resolve `expectedDirection: "improve"`. `null` means
 * ambiguous without knowing the goal's own direction (a bigger
 * weightChangeLb is "better" for a weight-loss goal only if that number
 * is *more negative*, and this module has no goal context) — those
 * metrics can only be evaluated with an explicit "increase"/"decrease",
 * never "improve". */
const HIGHER_IS_BETTER: Record<ExpectedMetricKey, boolean | null> = {
  weightChangeLb: null,
  averageWeightThisWeek: null,
  proteinAdherencePercent: true,
  calorieAdherencePercent: true,
  averageSleepMinutes: true,
  taskCompletionPercent: true,
  learningMinutes: true,
  averagePainThisWeek: false,
  averageSwellingThisWeek: false,
};

function classify(
  before: number | null,
  after: number | null,
  metric: ExpectedMetricKey,
  direction: ExpectedDirection
): OutcomeClassification {
  if (before === null || after === null) return "unknown";
  const delta = after - before;
  const epsilon = EPSILON[metric];
  const movedMeaningfully = Math.abs(delta) >= epsilon;

  if (direction === "stabilize") {
    return movedMeaningfully ? "neutral" : "helpful";
  }
  if (!movedMeaningfully) return "neutral";

  if (direction === "increase") return delta > 0 ? "helpful" : "harmful";
  if (direction === "decrease") return delta < 0 ? "helpful" : "harmful";

  // direction === "improve"
  const higherIsBetter = HIGHER_IS_BETTER[metric];
  if (higherIsBetter === null) return "unknown";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "helpful" : "harmful";
}

/**
 * Deterministic closed-loop experiment evaluation (no LLM). For each of
 * last week's *accepted* recommendations that named a falsifiable
 * expectedMetric/expectedDirection at proposal time, compares that
 * metric's value last week vs. this week and classifies whether it
 * appears to have worked. The caller (domains/review/service.ts) is
 * responsible for persisting `classification`/`before`/`after` back onto
 * the recommendation row — this function is pure.
 */
export function evaluateExperimentOutcomes(
  previousReview: { metrics: WeeklyMetrics; recommendations: EvaluableRecommendation[] } | null,
  currentMetrics: WeeklyMetrics
): ExperimentOutcome[] {
  if (!previousReview) return [];

  return previousReview.recommendations
    .filter((r) => r.accepted === true && r.expectedMetric !== null && r.expectedDirection !== null)
    .map((r): ExperimentOutcome => {
      const metric = r.expectedMetric as ExpectedMetricKey;
      const direction = r.expectedDirection as ExpectedDirection;
      const before = previousReview.metrics[metric];
      const after = currentMetrics[metric];
      const beforeNum = typeof before === "number" ? before : null;
      const afterNum = typeof after === "number" ? after : null;
      return {
        recommendationId: r.id,
        field: r.field,
        expectedMetric: metric,
        expectedDirection: direction,
        before: beforeNum,
        after: afterNum,
        delta: beforeNum !== null && afterNum !== null ? Math.round((afterNum - beforeNum) * 100) / 100 : null,
        classification: classify(beforeNum, afterNum, metric, direction),
      };
    });
}
