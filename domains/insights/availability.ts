/**
 * Per-user data availability (2026-09-03) — the gate every insight class
 * checks before it runs.
 *
 * The product principle: find the best insights for each user SUBJECT TO
 * the data they actually have. A user with workouts and food logs but no
 * sleep or weight should get great workout×nutrition findings, not empty
 * sections where sleep insights would have gone. So availability is a
 * first-class detector input, not something each generator infers by
 * counting nulls its own way.
 *
 * `days`/`recentDays` are counts of days WITH data, not calendar spans —
 * a metric logged twice a year is not "available" just because its span
 * is long. `usable` is a default floor for lifetime/pattern claims;
 * detectors with stricter needs (paired same-day samples, minimum n per
 * weekday bucket) must still enforce their own minimums on top.
 */

export type DomainAvailability = {
  /** Days with at least one observation, over the whole fetched history. */
  days: number;
  /** Days with data inside the last 30 calendar days — the "is this
   * still being logged" signal that separates present-tense claims
   * ("your Mondays are quiet") from archival ones ("you used to..."). */
  recentDays: number;
  firstDay: string | null;
  lastDay: string | null;
  usable: boolean;
};

export type DataAvailability = {
  steps: DomainAvailability;
  sleep: DomainAvailability;
  workouts: DomainAvailability;
  weight: DomainAvailability;
  heartRate: DomainAvailability;
  nutrition: DomainAvailability;
  tasks: DomainAvailability;
};

/** Days-with-data floors for the default `usable` flag, per domain.
 * Slow/sparse metrics (weight, workouts) earn usability on fewer days
 * than dense automatic ones (steps). */
const USABLE_FLOORS: Record<keyof DataAvailability, number> = {
  steps: 30,
  sleep: 14,
  workouts: 8,
  weight: 5,
  heartRate: 14,
  nutrition: 10,
  tasks: 10,
};

export type AvailabilityDayRow = {
  day: string; // YYYY-MM-DD ascending not required; handled here
  hasSteps: boolean;
  hasSleep: boolean;
  hasWorkout: boolean;
  hasWeight: boolean;
  hasHeartRate: boolean;
};

function summarize(
  domain: keyof DataAvailability,
  days: string[],
  recentCutoff: string
): DomainAvailability {
  if (days.length === 0) {
    return { days: 0, recentDays: 0, firstDay: null, lastDay: null, usable: false };
  }
  const sorted = [...days].sort();
  const count = sorted.length;
  const recentDays = sorted.filter((d) => d >= recentCutoff).length;
  return {
    days: count,
    recentDays,
    firstDay: sorted[0],
    lastDay: sorted[count - 1],
    usable: count >= USABLE_FLOORS[domain],
  };
}

export function computeAvailability(input: {
  rows: AvailabilityDayRow[];
  /** Days (YYYY-MM-DD) with >=1 nutrition log. */
  nutritionDays: string[];
  /** Days (YYYY-MM-DD) with >=1 task. */
  taskDays: string[];
  /** User-local today, YYYY-MM-DD. */
  today: string;
}): DataAvailability {
  // "Last 30 days" as a plain string cutoff — day strings are already
  // user-local YYYY-MM-DD, which compares correctly lexicographically.
  const cutoffDate = new Date(`${input.today}T00:00:00Z`);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30);
  const recentCutoff = cutoffDate.toISOString().slice(0, 10);

  const daysWhere = (pick: (r: AvailabilityDayRow) => boolean) =>
    input.rows.filter(pick).map((r) => r.day);

  return {
    steps: summarize("steps", daysWhere((r) => r.hasSteps), recentCutoff),
    sleep: summarize("sleep", daysWhere((r) => r.hasSleep), recentCutoff),
    workouts: summarize("workouts", daysWhere((r) => r.hasWorkout), recentCutoff),
    weight: summarize("weight", daysWhere((r) => r.hasWeight), recentCutoff),
    heartRate: summarize("heartRate", daysWhere((r) => r.hasHeartRate), recentCutoff),
    nutrition: summarize("nutrition", input.nutritionDays, recentCutoff),
    tasks: summarize("tasks", input.taskDays, recentCutoff),
  };
}
