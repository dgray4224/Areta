/**
 * The mid-week check: does the plan still match the week actually being
 * lived, and is there still time to do anything about it?
 *
 * Sunday is the right cadence for rewriting a week, but seven days is a
 * long silence. Miss Tuesday, eat out Wednesday, and the plan is stale
 * by Thursday with nothing said until the following Sunday — by which
 * point the advice is a post-mortem rather than a course correction.
 *
 * Three rules keep this from becoming a second brief:
 *
 *   - It only speaks between Wednesday and Friday. Earlier there is no
 *     evidence, later there is no time to act, and a check that fires on
 *     Monday is just a notification.
 *   - It returns at most one signal, the most actionable. A list of
 *     everything slightly off is the dashboard this product is trying
 *     not to be.
 *   - It returns null readily. A week going roughly to plan should hear
 *     nothing at all, because something that speaks every week stops
 *     being read.
 *
 * Pure: the caller supplies the week's state and does the I/O.
 */

export type MidweekSignalKind = "training_off_plan" | "behind_on_training" | "meals_not_fitting";

export type MidweekSignal = {
  kind: MidweekSignalKind;
  /** One sentence, addressed to the person. */
  headline: string;
  /** The evidence, so the claim is checkable rather than asserted. */
  detail: string;
};

export type MidweekInput = {
  /** Local day of week, 0 = Sunday, matching Date#getDay. */
  dayOfWeek: number;
  /** Planned sessions this week, one entry per training day, with
   * whether that day has been done and whether it has already passed. */
  plannedTrainingDays: { done: boolean; inPast: boolean }[];
  /** Days this week Health recorded real training on that the plan did
   * not ask for. */
  unplannedTrainingDays: number;
  mealsPlannedSoFar: number;
  mealsSkippedSoFar: number;
};

const FIRST_DAY = 3; // Wednesday
const LAST_DAY = 5; // Friday

/** Two is the point where it stops being a blip. One missed session in a
 * week is ordinary life and saying anything about it would be nagging. */
const MISSED_SESSIONS_THRESHOLD = 2;
const OFF_PLAN_DAYS_THRESHOLD = 2;
/** Skipping this share of the week's meals so far says the plan doesn't
 * fit the week, not that the person lacks discipline. */
const MEAL_SKIP_SHARE_THRESHOLD = 0.4;
const MEAL_SKIP_MIN_COUNT = 3;

export function midweekCheck(input: MidweekInput): MidweekSignal | null {
  if (input.dayOfWeek < FIRST_DAY || input.dayOfWeek > LAST_DAY) return null;

  const missed = input.plannedTrainingDays.filter((d) => d.inPast && !d.done).length;
  const remaining = input.plannedTrainingDays.filter((d) => !d.inPast && !d.done).length;

  // Trained, just not when the plan asked. This is the one worth saying
  // first, because it is the only one where the plan is at fault and the
  // fix is a change to the plan rather than to the person.
  if (input.unplannedTrainingDays >= OFF_PLAN_DAYS_THRESHOLD && missed >= MISSED_SESSIONS_THRESHOLD) {
    return {
      kind: "training_off_plan",
      headline: "You're training — just not on the days Areta picked.",
      detail: `${input.unplannedTrainingDays} session${input.unplannedTrainingDays === 1 ? "" : "s"} off plan, ${missed} planned ${
        missed === 1 ? "day" : "days"
      } missed. Worth moving your training days rather than trying harder to hit these ones.`,
    };
  }

  // Behind, but only worth saying while something can still be done.
  if (missed >= MISSED_SESSIONS_THRESHOLD && remaining >= 1) {
    return {
      kind: "behind_on_training",
      headline: `${missed} sessions missed, ${remaining} still to come.`,
      detail:
        remaining >= missed
          ? "There's still room to get the week back if you want it."
          : "Not all of it is recoverable this week — pick the one that matters most.",
    };
  }

  const skipShare = input.mealsPlannedSoFar > 0 ? input.mealsSkippedSoFar / input.mealsPlannedSoFar : 0;
  if (input.mealsSkippedSoFar >= MEAL_SKIP_MIN_COUNT && skipShare >= MEAL_SKIP_SHARE_THRESHOLD) {
    return {
      kind: "meals_not_fitting",
      headline: "This week's meals aren't fitting.",
      detail: `You've turned down ${input.mealsSkippedSoFar} of ${input.mealsPlannedSoFar} so far. Sunday's plan will adjust, but changing your cook nights in Settings fixes it sooner.`,
    };
  }

  return null;
}
