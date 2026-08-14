/**
 * Shared statistical toolkit for the insight detectors (Insight Engine v2,
 * 2026-08-14). Hand-rolled on purpose — no stats library — following
 * CLAUDE.md's "do not use an LLM for calculations code can perform" and the
 * repo's existing convention of small, exactly-testable pure functions
 * (see domains/review/correlations.ts's hand-rolled Pearson r).
 *
 * Why a permutation test rather than a t-test: it makes no normality
 * assumption, needs no distribution tables, and is ~20 lines of shuffling —
 * the right trade for behavioral data (task-completion percentages, sleep
 * minutes) that is bounded, skewed, and small-sample. Seeded PRNG so every
 * p-value is reproducible in tests and across cron re-runs.
 *
 * Multiple-comparison control is structural, by design, not a formula in
 * this file: each detector has a hard effect-size floor, detectors that
 * scan several hypotheses divide alpha by the scan width themselves
 * (Bonferroni by hand — see weekdayPattern's p < 0.05/7), and the
 * orchestrator caps how many pattern insights can surface per run.
 */

/** Deterministic PRNG (mulberry32) — tiny, fast, good-enough dispersion
 * for shuffling. Not cryptographic, doesn't need to be. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string — used to derive a per-user, per-detector
 * PRNG seed so permutation p-values are reproducible run-to-run without
 * being identical across users. */
export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Two-sample permutation test on the difference of means.
 *
 * Returns the two-sided p-value: the probability of seeing a mean
 * difference at least as extreme as the observed one if group labels were
 * random. Implementation: pool both groups, repeatedly shuffle
 * (Fisher-Yates with the seeded PRNG) and re-split at the original group
 * sizes, and count permutations whose |mean(A') - mean(B')| >= the
 * observed |mean(A) - mean(B)|. The +1 in numerator and denominator is the
 * standard finite-sample correction so p is never exactly 0.
 *
 * Callers must apply their own minimum-n guards BEFORE calling — a
 * permutation test on 3 vs 2 values will happily return a number that
 * means nothing.
 */
/**
 * Permutation p-value for an association statistic over paired samples
 * (e.g. Pearson r): shuffles `ys` against `xs` and counts how often the
 * shuffled |statistic| is at least the observed |statistic|. The
 * `statistic` callback is injected so callers keep their own
 * implementation (domains/review/correlations.ts passes its existing
 * pearsonR) — this module stays a generic toolkit with no domain imports.
 */
export function permutationPValueForAssociation(
  xs: number[],
  ys: number[],
  statistic: (xs: number[], ys: number[]) => number | null,
  options: { iterations?: number; seed?: number } = {}
): number {
  const iterations = options.iterations ?? 1000;
  const random = createSeededRandom(options.seed ?? 1);
  const observedStat = statistic(xs, ys);
  if (observedStat === null) return 1;
  const observed = Math.abs(observedStat);

  const shuffled = [...ys];
  let atLeastAsExtreme = 0;
  for (let i = 0; i < iterations; i++) {
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const permStat = statistic(xs, shuffled);
    if (permStat !== null && Math.abs(permStat) >= observed) atLeastAsExtreme++;
  }
  return (atLeastAsExtreme + 1) / (iterations + 1);
}

export function permutationPValue(
  groupA: number[],
  groupB: number[],
  options: { iterations?: number; seed?: number } = {}
): number {
  const iterations = options.iterations ?? 1000;
  const random = createSeededRandom(options.seed ?? 1);

  const observed = Math.abs((mean(groupA) ?? 0) - (mean(groupB) ?? 0));
  const pooled = [...groupA, ...groupB];
  const sizeA = groupA.length;

  let atLeastAsExtreme = 0;
  for (let i = 0; i < iterations; i++) {
    // Fisher-Yates shuffle of the pooled values.
    for (let j = pooled.length - 1; j > 0; j--) {
      const k = Math.floor(random() * (j + 1));
      [pooled[j], pooled[k]] = [pooled[k], pooled[j]];
    }
    const permA = pooled.slice(0, sizeA);
    const permB = pooled.slice(sizeA);
    const diff = Math.abs((mean(permA) ?? 0) - (mean(permB) ?? 0));
    if (diff >= observed) atLeastAsExtreme++;
  }

  return (atLeastAsExtreme + 1) / (iterations + 1);
}
