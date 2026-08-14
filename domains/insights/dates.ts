/** Small date-string helpers for the insight detectors — same YYYY-MM-DD
 * string convention as domains/review/dates.ts and
 * domains/activity-summary/timezone.ts. Duplicated from
 * domains/review/streaks.ts's private helper rather than exporting it from
 * there — review and insights are separate domains and shouldn't grow an
 * import edge for three lines. */

export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAY_SLUGS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function weekdayName(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek] ?? "Unknown";
}

export function weekdaySlug(dayOfWeek: number): string {
  return WEEKDAY_SLUGS[dayOfWeek] ?? "unknown";
}

/** 'YYYY-MM' month bucket used in pattern detectors' dedupe keys — the
 * resurfacing cooldown unit (a pattern insight can re-fire at most once per
 * calendar month; see the insights migration comment). */
export function monthBucket(dateStr: string): string {
  return dateStr.slice(0, 7);
}
