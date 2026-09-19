/**
 * Marking planned training done from what Apple Health already recorded.
 *
 * The product promises it works from what actually happened rather than
 * from you logging it, and for movement the data is genuinely there: one
 * real account has 758 workouts imported from Health, 314 planned
 * sessions, and zero marked complete. Adherence read zero while the phone
 * held 758 proofs of the opposite, and the weekly brief then told that
 * person they had given it nothing to work with.
 *
 * The match is deliberately day-level, not exercise-level. Health says
 * "strength training, 42 minutes"; it cannot say whether those were the
 * prescribed sets of bench press. Claiming otherwise would put a false
 * precision into the record the coach then reasons from. So the question
 * this answers is the honest one: did the person train on a day the plan
 * asked them to? Anything finer stays manual, and `completed_source`
 * keeps the two provenances apart everywhere downstream.
 */

export type PlannedItem = {
  id: string;
  /** Calendar date the item falls on: plan week_start + day_of_week. */
  date: string;
  completedAt: string | null;
};

export type RecordedWorkout = {
  /** Local calendar date the workout started on. */
  date: string;
  durationMinutes: number;
};

/**
 * Below this, a day's recorded training doesn't count as having done the
 * session. Guards against a watch that caught two minutes of something,
 * or a workout started and abandoned — both of which would otherwise
 * silently mark a full session complete.
 */
export const MIN_WORKOUT_MINUTES = 10;

/** Ids of planned items to mark complete. Pure: the caller does the I/O. */
export function itemsToAutoComplete(input: {
  plannedItems: PlannedItem[];
  recordedWorkouts: RecordedWorkout[];
  minMinutes?: number;
}): string[] {
  const minMinutes = input.minMinutes ?? MIN_WORKOUT_MINUTES;

  // Several short sessions in a day add up to having trained, so sum per
  // day rather than asking any single workout to clear the bar.
  const minutesByDay = new Map<string, number>();
  for (const w of input.recordedWorkouts) {
    if (!Number.isFinite(w.durationMinutes) || w.durationMinutes <= 0) continue;
    minutesByDay.set(w.date, (minutesByDay.get(w.date) ?? 0) + w.durationMinutes);
  }

  return input.plannedItems
    // Never re-complete and never un-complete: a person who ticked it
    // themselves, or unticked it on purpose, outranks the inference.
    .filter((item) => item.completedAt === null)
    .filter((item) => (minutesByDay.get(item.date) ?? 0) >= minMinutes)
    .map((item) => item.id);
}
