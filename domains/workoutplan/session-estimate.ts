/**
 * Roughly how long a planned session takes.
 *
 * The Today card said "5 exercises" and stopped, because it summed
 * `duration_minutes` and only 28 of one real account's 215 planned items
 * have one. That is not a data gap so much as a category error: a set of
 * eight squats has no duration, it has sets and reps and a rest period.
 * Timed work (a run, a row) carries minutes; strength work carries
 * structure. Both take time, and "how long will this take" is most of
 * what somebody deciding whether to train right now wants to know.
 *
 * So the estimate is built from whatever each item actually has, in
 * order of how much it is worth trusting: an explicit duration first,
 * then the prescription's own rest period, then a default rest. Nothing
 * is invented that the plan already states.
 *
 * It is an estimate and the interface says so ("about 40 min"). It is
 * rounded to five minutes to avoid implying a precision that isn't
 * there.
 */

export type EstimableItem = {
  /** Explicit minutes, for timed work. Wins outright when present. */
  durationMinutes: number | null;
  sets: number | null;
  reps: number | null;
  /** The prescription's own rest between sets, when the plan states it. */
  restSeconds?: number | null;
};

/** A rep of ordinary strength work, including the turnaround. */
const SECONDS_PER_REP = 3;
/** Used only when the prescription doesn't state its own rest. Close to
 * the observed average across real template slots (63s). */
const DEFAULT_REST_SECONDS = 60;
/** Changing, finding a bench, the first easy set. Charged once per
 * session, not per exercise. */
const SETUP_MINUTES = 5;
const ROUND_TO_MINUTES = 5;

/** Minutes for one item, or null when there is nothing to go on. */
export function estimateItemMinutes(item: EstimableItem): number | null {
  if (item.durationMinutes !== null && item.durationMinutes > 0) return item.durationMinutes;
  if (!item.sets || item.sets <= 0) return null;

  // Reps missing on a set-based item usually means a hold or a carry;
  // treating it as a single rep's worth of work plus rest is closer than
  // dropping the item entirely.
  const reps = item.reps && item.reps > 0 ? item.reps : 1;
  const rest = item.restSeconds && item.restSeconds > 0 ? item.restSeconds : DEFAULT_REST_SECONDS;
  // Rest is charged after every set, including the last. The final rest
  // of an exercise is the walk to the next one, and an earlier version
  // that dropped it came out at 25 minutes for a fifteen-set session,
  // which nobody has ever finished that fast. On a card someone uses to
  // decide whether they have time, running over is the worse error.
  const seconds = item.sets * (reps * SECONDS_PER_REP + rest);
  return seconds / 60;
}

/**
 * Minutes for a whole session, or null when nothing in it can be
 * estimated — in which case the interface should say nothing rather than
 * guess, since a wrong number is worse than an absent one.
 */
export function estimateSessionMinutes(items: EstimableItem[]): number | null {
  const perItem = items.map(estimateItemMinutes).filter((m): m is number => m !== null);
  if (perItem.length === 0) return null;

  const total = perItem.reduce((sum, m) => sum + m, 0) + SETUP_MINUTES;
  return Math.max(ROUND_TO_MINUTES, Math.round(total / ROUND_TO_MINUTES) * ROUND_TO_MINUTES);
}
