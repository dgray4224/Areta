/**
 * The single scoring + ranking step (Insights Layer, 2026-08-17).
 *
 * Replaces per-detector magic numbers (`score: 82`,
 * `Math.min(88, 45 + effectPp * 1.5)`) with one function every generator
 * feeds. Two reasons that matters beyond tidiness:
 *
 * 1. A detector scoring itself cannot know how it compares to a detector
 *    it has never heard of. Ranking is a cross-generator question, so it
 *    belongs outside every individual generator.
 * 2. The old numbers were unattributable. Now the five components are
 *    stored on the row, so "why did this outrank that" is a SQL query and
 *    a ranking regression is visible instead of vibes.
 *
 * RANKING IS TIER-BLIND. `tier` is recorded for analysis and never enters
 * the score. A strong Tier 1 phone-only finding must be able to outrank a
 * marginal Tier 3 wearable one -- the temptation is to privilege
 * sleep/HRV because they sound more scientific, and that temptation is
 * how this becomes a dashboard.
 */

/** Data tier, recorded for analysis only -- deliberately NOT a score input. */
export type DataTier = 0 | 1 | 2 | 3;

export type ScoreComponents = {
  /** Magnitude of the relationship, normalized 0-1 by the generator --
   * only the generator knows what "big" means for its own units. */
  effectSize: number;
  /** Confidence from n. Never scored without effectSize (see below). */
  sampleSize: number;
  /** Can the user do anything with it? "Steps drop on Wednesdays" is
   * inert; "your plan collapses after 2pm" is not. */
  actionability: number;
  /** Does this touch a domain the user has an active goal in? */
  goalRelevance: number;
  /** Deviation from what a reasonable person would guess. The
   * differentiator, and the one nobody builds. */
  surprise: number;
};

export type ScoredCandidate = {
  score: number;
  components: ScoreComponents;
};

/**
 * Weights. Surprise carries the most because without it this is a
 * dashboard: a statistically perfect finding that everyone already
 * assumed is worth approximately nothing to show someone.
 *
 * Effect and sample are weighted together below rather than independently
 * -- see combineEvidence.
 */
const WEIGHTS = {
  evidence: 0.35,
  actionability: 0.2,
  goalRelevance: 0.15,
  surprise: 0.3,
} as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Effect size and sample size multiply rather than add.
 *
 * Added, a huge effect measured over four days scores respectably, and
 * you ship "based on 4 days" findings -- the single fastest way to lose a
 * user's trust in everything else the app claims. Multiplied, weak
 * evidence on either axis suppresses the finding regardless of how
 * exciting the other axis looks.
 */
function combineEvidence(effectSize: number, sampleSize: number): number {
  return clamp01(effectSize) * clamp01(sampleSize);
}

/**
 * Maps a raw observation count onto 0-1. Deliberately harsh below ~2
 * weeks: 14 days scores 0.5, 30 days ~0.75, 60+ approaches 1. Nothing
 * reaches 1, because more data is always better than the data you have.
 */
export function sampleSizeScore(n: number): number {
  if (n <= 0) return 0;
  return clamp01(1 - Math.exp(-n / 20));
}

/**
 * Surprise from an observed-vs-expected comparison.
 *
 * `expected` is what a naive baseline would predict -- population
 * assumption, the user's own overall mean, or simply "no relationship".
 * Score is the normalized deviation, so an observation that matches the
 * naive guess scores ~0 however clean its statistics are.
 *
 * Direction inversion is scored highest on purpose. "You walk more on
 * days you work out" is worthless at any p-value; "you walk LESS on days
 * you work out" is the whole product.
 */
export function surpriseScore(observed: number, expected: number, scale: number): number {
  if (!Number.isFinite(observed) || !Number.isFinite(expected) || scale <= 0) return 0;
  const deviation = Math.abs(observed - expected) / scale;
  const inverted = Math.sign(observed) !== 0 && Math.sign(expected) !== 0 && Math.sign(observed) !== Math.sign(expected);
  // An inversion is categorically more surprising than a large move in
  // the expected direction, so it gets a floor rather than just a bigger
  // deviation.
  const base = clamp01(deviation / 2);
  return inverted ? clamp01(Math.max(0.7, base)) : base;
}

/**
 * Final 0-100 score. Kept on the same scale the old hardcoded numbers
 * used so existing consumers (feed ordering, the per-run pattern cap,
 * push eligibility thresholds) keep working unchanged.
 */
export function scoreCandidate(components: ScoreComponents): ScoredCandidate {
  const evidence = combineEvidence(components.effectSize, components.sampleSize);
  const weighted =
    evidence * WEIGHTS.evidence +
    clamp01(components.actionability) * WEIGHTS.actionability +
    clamp01(components.goalRelevance) * WEIGHTS.goalRelevance +
    clamp01(components.surprise) * WEIGHTS.surprise;

  return {
    score: Math.round(clamp01(weighted) * 100),
    components: {
      effectSize: clamp01(components.effectSize),
      sampleSize: clamp01(components.sampleSize),
      actionability: clamp01(components.actionability),
      goalRelevance: clamp01(components.goalRelevance),
      surprise: clamp01(components.surprise),
    },
  };
}

/**
 * Goal relevance for a finding touching `domainKey`, given the domains
 * the user currently has active goals in.
 *
 * Not binary: a finding in a goal domain is worth more, but one outside
 * every goal is not worthless -- the most useful discoveries are
 * frequently in areas the user had not thought to set a goal about, and
 * zeroing those would systematically hide them.
 */
export function goalRelevanceScore(domainKey: string | null, activeGoalDomains: Set<string>): number {
  if (!domainKey) return 0.3;
  return activeGoalDomains.has(domainKey) ? 1 : 0.3;
}
