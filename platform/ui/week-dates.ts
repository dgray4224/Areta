/** The Sun-Sat calendar dates for the week containing `anchor`, as
 * YYYY-MM-DD strings — index i matches day_of_week i (0=Sun..6=Sat). */
export function getWeekDates(anchor: string): string[] {
  const d = new Date(`${anchor}T00:00:00Z`);
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(sunday);
    dt.setUTCDate(sunday.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

/** `anchor` shifted by `days` (negative to go backward), as a YYYY-MM-DD
 * string. UTC-based, same convention as getWeekDates, so chaining the two
 * (e.g. stepping a week_start forward by 7 repeatedly) never drifts across
 * a DST boundary the way local-time arithmetic could. */
export function addDays(anchor: string, days: number): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How many consecutive weeks (current + this many more) self-service
 * meal/workout plans should stay generated & active for at all times
 * (2026-08-09) -- "a rolling month," so a user who grocery-shops every
 * 1-4 weeks always has real plan/grocery content that far ahead, not
 * `weeksMissingPlan` gaps. One shared definition -- both
 * domains/mealplan/approve-flow.ts#ensureMealPlanWeeksAhead and
 * domains/workoutplan/service.ts#ensureWorkoutPlanWeeksAhead, plus both
 * regenerate-*-plans crons, import this rather than each hardcoding 4. */
export const SELF_SERVICE_WEEKS_AHEAD = 4;
