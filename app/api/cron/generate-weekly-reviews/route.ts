import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { localDateString } from "@/domains/activity-summary/timezone";
import { getOrCreateWeeklyReview, generateWeeklyBrief } from "@/domains/review/service";

/**
 * Daily cron (see vercel.json): generates each user's weekly brief
 * automatically, on *their own* weekly_review_day preference (captured
 * during onboarding's identity step, profiles.weekly_review_day, 0=Sunday
 * .. 6=Saturday — same convention as JS Date#getDay()) — not a single
 * fixed day for everyone, unlike the plan-regeneration crons above this
 * one in vercel.json. There is deliberately no manual "generate" button
 * anywhere (web or mobile) as of this pass — this cron is the only
 * trigger. A user whose local day doesn't match today is skipped
 * entirely; last week's brief (if any) stays visible/static in the UI
 * until their next review day produces a new one, since each week is its
 * own weekly_reviews row keyed by week_start and nothing here touches
 * past rows.
 *
 * Runs once daily at a single fixed UTC hour (not per-timezone-exact) —
 * a deliberate v1 simplification ("weekly for now"): a user's local
 * "today" at that one fixed UTC instant decides whether they're due, so
 * the actual local time-of-day their brief appears can vary by
 * timezone. Good enough for a once-a-week generation; revisit only if
 * users start noticing/minding the local-time drift.
 *
 * getOrCreateWeeklyReview+generateWeeklyBrief already guard against
 * double-processing: getOrCreateWeeklyReview reuses the existing row for
 * the current rolling week if one exists (nothing duplicated if the cron
 * ever fires twice in a day), and this route additionally skips anyone
 * whose current-week status is already "generated"/"approved" so a
 * previously-generated brief is never silently overwritten.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, time_zone, weekly_review_day")
    .not("weekly_review_day", "is", null)
    .not("onboarding_completed_at", "is", null);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const dueUserIds = (profiles ?? [])
    .filter((p) => {
      const timezone = p.time_zone ?? "UTC";
      const localToday = localDateString(new Date(), timezone);
      const localWeekday = new Date(`${localToday}T00:00:00Z`).getUTCDay();
      return localWeekday === p.weekly_review_day;
    })
    .map((p) => p.id);

  const results = await Promise.allSettled(
    dueUserIds.map(async (userId) => {
      const review = await getOrCreateWeeklyReview(userId, supabase);
      if (review.status === "generated" || review.status === "approved") {
        return { userId, skipped: true as const };
      }
      const result = await generateWeeklyBrief(userId, supabase);
      if (!result.ok) throw new Error(result.error);
      return { userId, skipped: false as const };
    })
  );

  let generated = 0;
  let alreadyDone = 0;
  const failures: { userId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push({ userId: dueUserIds[i], error: String(r.reason) });
    } else if (r.value.skipped) {
      alreadyDone++;
    } else {
      generated++;
    }
  });

  return NextResponse.json({ checked: dueUserIds.length, generated, alreadyDone, failures });
}
