/**
 * The never-relaxed safety floor, shared by every path that chooses an
 * exercise for a user.
 *
 * This logic used to live inline in fill-slots.ts, which was fine while
 * the template engine was the only way an exercise reached a plan. It
 * isn't any more: generate-today.ts builds a session on demand from a
 * body-part choice. Two independent implementations of an injury filter
 * is exactly the bug you don't want to ship, so there is one here and
 * both callers use it.
 *
 * Plain module (no "use server") so it can export non-async values --
 * see the 2026-08-07 production incident noted in types.ts.
 */
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { ExperienceTier, LimitationRule } from "@/domains/recommendation/types";

export type SafetyFilter = {
  /** True when the user declared an injury AND named at least one area.
   * Declaring "yes" with no tags gives us nothing to filter on. */
  hasLimitations: boolean;
  /** The rules that actually apply to this user, for callers that need
   * to surface them -- e.g. `manual_review` rules become warnings. */
  activeRules: LimitationRule[];
  /** Movement patterns the user's limitation rules exclude outright. */
  excludedPatterns: Set<string>;
  /** pattern -> replacement pattern, per substitute rules. Keeps the
   * stimulus, drops the aggravating movement. */
  substituteByPattern: Map<string, string>;
  /** The floor itself. Never relax this -- callers may widen a pool by
   * dropping equipment, pattern or preference constraints, but every
   * candidate they consider must already have passed here. */
  isSafe: (exercise: Exercise) => boolean;
};

export function buildSafetyFilter(
  exercise: ExerciseInput,
  limitationRules: LimitationRule[],
  tier: ExperienceTier
): SafetyFilter {
  const userTags = new Set<string>(exercise.limitationTags ?? []);
  const hasLimitations = Boolean(
    exercise.injuryStatus && exercise.injuryStatus !== "no" && userTags.size > 0
  );

  const activeRules = hasLimitations
    ? limitationRules.filter((r) => userTags.has(r.limitationTag))
    : [];

  const excludedPatterns = new Set(
    activeRules
      .filter((r) => r.action === "exclude" && r.movementPattern)
      .map((r) => r.movementPattern!)
  );

  const substituteByPattern = new Map(
    activeRules
      .filter((r) => r.action === "substitute" && r.movementPattern && r.substituteMovementPattern)
      .map((r) => [r.movementPattern!, r.substituteMovementPattern!] as const)
  );

  const isSafe = (e: Exercise): boolean => {
    if (hasLimitations) {
      if (e.limitationTags.some((tag) => userTags.has(tag))) return false;
      if (e.movementPatterns.some((p) => excludedPatterns.has(p))) return false;
    }
    // A beginner is never handed an advanced movement, injury or not.
    if (tier === "beginner" && e.difficulty === "advanced") return false;
    return true;
  };

  return { hasLimitations, activeRules, excludedPatterns, substituteByPattern, isSafe };
}
