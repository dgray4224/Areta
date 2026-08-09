import type { WeeklyMetrics } from "@/domains/review/metrics";

/** The only metric pairs worth testing — chosen because a real
 * relationship between them would be genuinely cross-domain (the thing a
 * single-purpose app like Whoop/MyFitnessPal/Oura can't compute, since
 * each only ever sees one side of the pair). Each entry names two
 * `WeeklyMetrics` fields; both must be numeric (not the categorical
 * pain/swelling trend labels). */
const CANDIDATE_PAIRS: readonly [keyof WeeklyMetrics, keyof WeeklyMetrics][] = [
  ["averageSleepMinutes", "taskCompletionPercent"],
  ["averageSleepMinutes", "calorieAdherencePercent"],
  ["proteinAdherencePercent", "averagePainThisWeek"],
  ["learningMinutes", "taskCompletionPercent"],
  ["taskCompletionPercent", "weightChangeLb"],
  ["learningMinutes", "averageSleepMinutes"],
];

/** Below this many paired (both-non-null) weeks, a correlation coefficient
 * is noise, not a finding — mirrors `isDataSparse`'s "&lt;3 logged days"
 * convention in metrics.ts, one notch higher since this needs *weeks*,
 * a scarcer unit than days. */
const MIN_PAIRED_WEEKS = 4;

/** Below this |r|, a relationship is too weak to be worth surfacing as an
 * "eye-opening" finding — a conventional threshold for a "moderate"
 * correlation. */
const MIN_ABS_R = 0.5;

const MAX_FINDINGS = 2;

export type CorrelationFinding = {
  metricA: keyof WeeklyMetrics;
  metricB: keyof WeeklyMetrics;
  r: number;
  direction: "positive" | "negative";
  weekCount: number;
  sampleWeeks: string[];
};

function pearsonR(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }
  const denominator = Math.sqrt(sumSqX * sumSqY);
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Deterministic cross-domain correlation mining (no LLM). Pairs candidate
 * `WeeklyMetrics` fields across the user's own multi-week
 * `weekly_reviews.metrics` history and returns the strongest real
 * relationships found — plain numbers/labels the AI narrates but can
 * never alter or recompute (CLAUDE.md: "Do not use an LLM for
 * calculations that code can perform"). Weekly-grain only (not
 * day-level) — see this feature's plan doc for why day-level pairing is
 * out of v1 scope.
 */
export function computeMetricCorrelations(
  history: { weekStart: string; metrics: WeeklyMetrics }[]
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];

  for (const [metricA, metricB] of CANDIDATE_PAIRS) {
    const paired = history.filter((h) => {
      const a = h.metrics[metricA];
      const b = h.metrics[metricB];
      return typeof a === "number" && typeof b === "number";
    });
    if (paired.length < MIN_PAIRED_WEEKS) continue;

    const xs = paired.map((h) => h.metrics[metricA] as number);
    const ys = paired.map((h) => h.metrics[metricB] as number);
    const r = pearsonR(xs, ys);
    if (r === null || Math.abs(r) < MIN_ABS_R) continue;

    findings.push({
      metricA,
      metricB,
      r: Math.round(r * 100) / 100,
      direction: r >= 0 ? "positive" : "negative",
      weekCount: paired.length,
      sampleWeeks: paired.map((h) => h.weekStart),
    });
  }

  return findings.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, MAX_FINDINGS);
}
