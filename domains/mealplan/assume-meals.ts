/**
 * Deciding which planned meals to treat as eaten once a day is over.
 *
 * The product's promise is that you don't log. For movement that is
 * already true, because Health supplies it; for food it was not, because
 * every meal needed a tap and almost nobody taps. Across the first 13
 * accounts the entire history was 19 meals ticked, so nutrition adherence
 * was permanently blank and the weekly brief could only ever say it had
 * nothing to work with.
 *
 * So silence now means the plan happened. That is a real claim about
 * someone's diet, and it drives calorie advice, so two things keep it
 * honest: every assumed meal is stamped `assumed` rather than passed off
 * as confirmed, and saying "didn't eat this" is a first-class answer
 * recorded as `skipped_at`. Without that second state a decline would be
 * indistinguishable from not having been asked yet, and the next night's
 * pass would quietly overrule the person.
 *
 * Only whole past days are assumed. Assuming today's dinner at lunchtime
 * would be inventing the future, and a person who eats it later would
 * see the app claim it before they did.
 *
 * Pure on purpose: the caller does the I/O.
 */

export type AssumableItem = {
  id: string;
  /** Calendar date the item falls on: plan week_start + day_of_week. */
  date: string;
  completedAt: string | null;
  skippedAt: string | null;
  /** When the item was added to the plan. A meal that appeared after its
   * own day was over was never something the person could have followed,
   * so it must not be assumed eaten — see the guard below. */
  createdAt?: string;
};

/**
 * How far back to fill in. A day or two of phone-off travel should still
 * resolve when the app comes back; beyond that the person has no real
 * memory of the meal either, and inventing a fortnight of intake in one
 * pass would move their averages on nothing but absence.
 */
export const MAX_ASSUME_LOOKBACK_DAYS = 3;

export function itemsToAssumeEaten(input: {
  items: AssumableItem[];
  /** The user's local today. Days strictly before this are over. */
  today: string;
  lookbackDays?: number;
}): string[] {
  const lookback = input.lookbackDays ?? MAX_ASSUME_LOOKBACK_DAYS;
  const earliest = addDays(input.today, -lookback);

  return input.items
    // Answered either way already: never overrule the person.
    .filter((item) => item.completedAt === null && item.skippedAt === null)
    // Strictly in the past: today is still being lived.
    .filter((item) => item.date < input.today)
    .filter((item) => item.date >= earliest)
    // The plan has to have existed on the day it describes. The meal
    // cron backfills a week that is already underway, so without this a
    // plan generated on Thursday would be "followed" on Monday — intake
    // invented for days when there was nothing to follow.
    .filter((item) => item.createdAt === undefined || item.createdAt.slice(0, 10) <= item.date)
    .map((item) => item.id);
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
