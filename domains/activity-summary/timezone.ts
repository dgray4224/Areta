/** IANA timezone helpers for bucketing raw log timestamps into a user's
 * local calendar day/hour -- the whole point of activity_daily_summaries is
 * *when* something happened, so this must be zone-aware rather than the
 * UTC-based day boundaries used elsewhere in the app (see
 * app/(app)/dashboard/data.ts's todayDateString() for that known gap). Not
 * a Server Action file -- shared pure helpers, matching
 * domains/review/dates.ts's precedent. No date library dependency needed;
 * Intl.DateTimeFormat with a timeZone option covers everything here. */

const MS_PER_MINUTE = 60000;

/** YYYY-MM-DD for `instant` in `timezone`. */
export function localDateString(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Local hour (0-23) of `instant` in `timezone`. */
export function localHour(instant: Date, timezone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      hour: "2-digit",
    }).format(instant)
  );
}

/** HH:MM:SS (local wall-clock time-of-day) for `instant` in `timezone`. */
export function localTimeString(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

// Offset (in minutes) such that formatting `instant` in `timezone` and
// reinterpreting those wall-clock digits as UTC yields `instant + offset`.
// E.g. for a UTC-8 zone, offset is -480 (the local wall clock reads 8 hours
// "earlier" than the instant's true UTC reading).
function tzOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - instant.getTime()) / MS_PER_MINUTE;
}

// Resolves the UTC instant for a given wall-clock reading (year/month/day/
// hour, all local) in `timezone`, iterating twice to converge correctly
// across a DST transition -- the offset at a first guess can differ from
// the offset that actually applies at the resolved instant.
function zonedWallClockToUtc(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = targetAsUtc;
  for (let i = 0; i < 2; i++) {
    const offset = tzOffsetMinutes(new Date(guess), timezone);
    const candidate = targetAsUtc - offset * MS_PER_MINUTE;
    if (candidate === guess) break;
    guess = candidate;
  }
  return new Date(guess);
}

/** The [start, end) UTC instant range covering the local calendar day
 * `localDay` (YYYY-MM-DD) in `timezone` -- DST-safe (a local day can be 23
 * or 25 hours long; this resolves each boundary independently rather than
 * assuming a fixed 24h span). */
export function localDayUtcRange(localDay: string, timezone: string): { start: Date; end: Date } {
  const [year, month, day] = localDay.split("-").map(Number);
  const start = zonedWallClockToUtc(year, month, day, 0, timezone);

  const nextDayUtcGuess = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedWallClockToUtc(
    nextDayUtcGuess.getUTCFullYear(),
    nextDayUtcGuess.getUTCMonth() + 1,
    nextDayUtcGuess.getUTCDate(),
    0,
    timezone
  );

  return { start, end };
}
