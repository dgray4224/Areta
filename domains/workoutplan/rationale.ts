/**
 * Explains *why* today's session looks the way it does, in terms of the
 * user's own real adjacent-day schedule -- not a generic description of
 * today in isolation. Pure and DB-free (mirrors rotation.ts) so it's
 * unit-testable with hand-built fixtures; the caller (app/api/exercise/
 * route.ts) resolves today's and tomorrow's actual session/exercise-count
 * data from the already-materialized workout_plan_items for the week.
 *
 * Deliberately rule-based on real structural fields (session_type, real
 * exercise counts) rather than free-text generation -- matches this
 * app's no-fabrication stance on training content (see
 * docs/training-content-pipeline.md's non-negotiable rule) and CLAUDE.md
 * rule 6 (deterministic, not AI-generated, for plan-shaping logic).
 */

/** Session types that represent real, demanding endurance work where
 * fresh legs matter -- distinct from "conditioning" (short anaerobic
 * work), which doesn't carry the same next-day-freshness argument. */
const ENDURANCE_SESSION_TYPES = new Set(["run", "bike", "swim", "brick"]);

export type RationaleSessionSummary = {
  name: string;
  sessionType: string;
  /** Count of primary (non-alternate) planned exercises materialized for
   * this session's day. */
  exerciseCount: number;
} | null;

export type BuildWorkoutRationaleInput = {
  today: RationaleSessionSummary;
  /** Tomorrow's session, or null if tomorrow is a rest day (no session
   * materialized for that day-of-week). */
  tomorrow: RationaleSessionSummary;
};

/**
 * Deliberately does NOT fall back to training_program_phases.focus --
 * that's a phase-level description ("this phase builds full-body
 * strength..."), not an explanation of *this specific workout*. The
 * phase-focus data itself is untouched in the DB/plan payload; it's
 * just not this function's job to surface it (a future Plan/Review
 * screen is the right home for that -- see README). Returns null
 * outright when no specific today/tomorrow relationship applies, rather
 * than reaching for a generic phase-level justification.
 */
export function buildWorkoutRationale(input: BuildWorkoutRationaleInput): string | null {
  const { today, tomorrow } = input;

  if (!today) return null;

  // Strength today, real endurance work tomorrow -- the case the app's
  // exercise-count decisions most need to explain (e.g. a lighter
  // strength day ahead of a long run).
  if (today.sessionType === "strength" && tomorrow && ENDURANCE_SESSION_TYPES.has(tomorrow.sessionType)) {
    return `Kept today at ${today.exerciseCount} exercise${today.exerciseCount === 1 ? "" : "s"} to keep your legs fresh for tomorrow's "${tomorrow.name}."`;
  }

  // Both strength days -- compare real exercise counts rather than
  // guessing intensity from the session name.
  if (today.sessionType === "strength" && tomorrow && tomorrow.sessionType === "strength") {
    if (today.exerciseCount < tomorrow.exerciseCount) {
      return `Lighter strength day today (${today.exerciseCount} exercises) -- tomorrow's "${tomorrow.name}" carries more volume.`;
    }
    if (today.exerciseCount > tomorrow.exerciseCount) {
      return `Today carries more volume than tomorrow's "${tomorrow.name}," which is intentionally lighter to help you recover.`;
    }
  }

  // Endurance work today, strength tomorrow -- the reverse relationship,
  // framed around tomorrow rather than today's own exercise count.
  if (ENDURANCE_SESSION_TYPES.has(today.sessionType) && tomorrow && tomorrow.sessionType === "strength") {
    return `Today's "${today.name}" is the priority -- tomorrow's strength session follows once you've recovered from it.`;
  }

  return null;
}
