/**
 * Is the weekly brief actually being written?
 *
 * Asked because it wasn't, for four weeks, and nothing noticed (2026-08-23
 * to 2026-09-19: a stale ANTHROPIC_API_KEY in Vercel, every run 401ing).
 * The cron counted its own failures and returned them in a JSON response
 * no human ever reads, so the product's core promise quietly stopped
 * happening while every screen kept saying "your brief lands Sunday".
 *
 * Two different silences have to be caught, which is why staleness is
 * checked separately from failure:
 *
 *   - the job runs and fails    → attempts with no successes
 *   - the job stops running     → no attempts at all
 *
 * A check that only watched for errors would have been blind to the
 * second, and the second is the worse one.
 *
 * Pure on purpose: the route does the I/O, this decides.
 */

export type AiRunSample = {
  createdAt: string;
  success: boolean;
  error: string | null;
};

export type HealthVerdict = {
  healthy: boolean;
  /** Short line naming what is wrong; null when healthy. */
  reason: string | null;
  /** Human-readable evidence, safe to put in an alert body. */
  detail: string;
  lastSuccessAt: string | null;
  daysSinceSuccess: number | null;
};

const DAY_MS = 86_400_000;

/** A brief is due weekly, so a week plus a day of slack before we call it
 * stale. Tight enough to catch an outage on its first missed cycle. */
export const STALE_AFTER_DAYS = 8;

function daysBetween(fromIso: string, now: Date): number {
  return (now.getTime() - new Date(fromIso).getTime()) / DAY_MS;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** First line of an error, trimmed — provider errors carry a whole JSON
 * blob and an alert only needs enough to recognise the class of problem. */
export function summarizeError(error: string | null, max = 160): string {
  const line = (error ?? "").replace(/\s+/g, " ").trim();
  if (!line) return "no error text recorded";
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

export function assessWeeklyBriefHealth(input: {
  runs: AiRunSample[];
  /** Onboarded users with a review day set. Zero means nothing is expected
   * of the cron, so silence is correct rather than alarming. */
  eligibleUsers: number;
  now?: Date;
}): HealthVerdict {
  const now = input.now ?? new Date();
  const runs = [...input.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const lastSuccess = runs.find((r) => r.success) ?? null;
  const lastSuccessAt = lastSuccess?.createdAt ?? null;
  const daysSinceSuccess = lastSuccessAt ? round1(daysBetween(lastSuccessAt, now)) : null;

  if (input.eligibleUsers === 0) {
    return {
      healthy: true,
      reason: null,
      detail: "No onboarded users have a review day set, so no brief is expected.",
      lastSuccessAt,
      daysSinceSuccess,
    };
  }

  const last24h = runs.filter((r) => daysBetween(r.createdAt, now) <= 1);
  const failed24h = last24h.filter((r) => !r.success);

  // The job ran and every attempt failed. Loudest case, and the one that
  // fires on the first bad Sunday rather than a week later.
  if (last24h.length > 0 && failed24h.length === last24h.length) {
    return {
      healthy: false,
      reason: `Every weekly brief failed in the last 24 hours (${failed24h.length} of ${last24h.length})`,
      detail: `Sample error: ${summarizeError(failed24h[0].error)}. Last success: ${
        lastSuccessAt ? `${daysSinceSuccess} days ago` : "never"
      }.`,
      lastSuccessAt,
      daysSinceSuccess,
    };
  }

  // Nothing has succeeded in over a week. Catches a silently dead cron,
  // which produces no failures to count.
  if (daysSinceSuccess === null || daysSinceSuccess > STALE_AFTER_DAYS) {
    const ran = runs.length > 0;
    return {
      healthy: false,
      reason: lastSuccessAt
        ? `No weekly brief has generated in ${daysSinceSuccess} days`
        : "No weekly brief has ever generated",
      detail: ran
        ? `${runs.length} attempt(s) on record, none recent enough. Last attempt ${round1(
            daysBetween(runs[0].createdAt, now)
          )} days ago. ${input.eligibleUsers} user(s) are due one weekly.`
        : `No attempts on record at all — the cron itself may not be running. ${input.eligibleUsers} user(s) are due one weekly.`,
      lastSuccessAt,
      daysSinceSuccess,
    };
  }

  return {
    healthy: true,
    reason: null,
    detail: `Last brief generated ${daysSinceSuccess} days ago; ${failed24h.length} failure(s) in the last 24h.`,
    lastSuccessAt,
    daysSinceSuccess,
  };
}
