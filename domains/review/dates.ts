import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { resolveTimezone, todayForUser } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";

/** Not a Server Action file ("use server" files may only export async
 * functions) — these plain date helpers are shared by service.ts and
 * approve-flow.ts. Timezone-aware per profiles.time_zone via the same
 * todayForUser/resolveTimezone helpers used elsewhere (see
 * domains/activity-summary/service.ts) — previously used
 * `new Date().toISOString()` (UTC), which put the week boundary a day off
 * for any user not near UTC (the same bug class fixed in the Plan tab,
 * commit 4adcf23). */
export async function todayIso(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  return todayForUser(supabase, userId);
}

/** Sunday, matching onboarding's default and profiles.weekly_review_day's
 * 0=Sunday convention, for the rare row with no preference stored. */
const DEFAULT_REVIEW_DAY = 0;

/**
 * The key for the user's CURRENT review cycle: the most recent occurrence
 * of their review day, today included.
 *
 * This anchors to the review day on purpose. Until 2026-09-26 it returned
 * `today - 6`, a window that slid forward every single day — so the row
 * the app looked up was a different row each morning, while the cron had
 * written the brief into whichever row existed on the review day. The
 * result was a brief that could only ever be seen on the day it was
 * generated: 12 of 13 briefs generated on Sunday 2026-09-20 all landed on
 * week_start 2026-09-14, and by Monday every user was looking at an empty
 * row and being told their first brief was still coming. The cron's own
 * doc comment already described the behaviour this function now has
 * ("each week is its own weekly_reviews row keyed by week_start").
 *
 * Anchored, the row is stable for the whole cycle: generated once on the
 * review day, read from every day after it until the next one.
 */
export async function reviewWeekStart(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const [timezone, reviewDay] = await Promise.all([
    resolveTimezone(supabase, userId),
    reviewDayFor(supabase, userId),
  ]);
  return weekStartForReviewDay(localDateString(new Date(), timezone), reviewDay);
}

/** The anchoring itself, with the I/O taken out so it can be tested --
 * this is the arithmetic that was wrong for two weeks. */
export function weekStartForReviewDay(today: string, reviewDay: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  const daysSinceReviewDay = (d.getUTCDay() - reviewDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceReviewDay);
  return d.toISOString().slice(0, 10);
}

async function reviewDayFor(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("weekly_review_day")
    .eq("id", userId)
    .maybeSingle();
  const day = data?.weekly_review_day;
  return typeof day === "number" && day >= 0 && day <= 6 ? day : DEFAULT_REVIEW_DAY;
}

/**
 * The seven completed days a review reports on: the week ENDING the day
 * before the cycle's anchor.
 *
 * Deliberately excludes the anchor day itself and everything after it.
 * A brief is a verdict on a finished week — if the window ran up to
 * "today" instead, the numbers under it would keep changing all week
 * while the narrative written on the review day stayed put, and by
 * Saturday the brief would be discussing figures that no longer matched
 * the ones printed beside it.
 */
export function reviewWindowFor(weekStart: string): { start: string; end: string } {
  const anchor = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(anchor);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
