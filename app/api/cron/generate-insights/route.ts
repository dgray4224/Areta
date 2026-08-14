import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { localDateString } from "@/domains/activity-summary/timezone";
import { computeAndStoreInsights } from "@/domains/insights/service";

/**
 * Daily cron (see vercel.json): runs the Insight Engine v2 detector
 * battery for every onboarded user. Two cadences inside one cron, per
 * domains/insights/service.ts's doc comment:
 * - records/streaks run for everyone, every day (cheap, and a personal
 *   record deserves same-day delivery);
 * - the statistical pattern scans run only on each user's own
 *   weekly_review_day — the same per-user local-weekday gating
 *   generate-weekly-reviews uses, so pattern insights land the same day
 *   the weekly brief does and can feed its narrative (Phase 3).
 *
 * Idempotent by construction: every insight's dedupe_key is unique per
 * user, so re-running the cron (or a retry after a partial failure)
 * can't duplicate anything — computeAndStoreInsights just reports them
 * as duplicates.
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
    .not("onboarding_completed_at", "is", null);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const users = (profiles ?? []).map((p) => {
    const timezone = p.time_zone ?? "UTC";
    const localToday = localDateString(new Date(), timezone);
    const localWeekday = new Date(`${localToday}T00:00:00Z`).getUTCDay();
    return {
      userId: p.id,
      includePatternScans: p.weekly_review_day !== null && localWeekday === p.weekly_review_day,
    };
  });

  const results = await Promise.allSettled(
    users.map(async ({ userId, includePatternScans }) => {
      const result = await computeAndStoreInsights(userId, supabase, { includePatternScans });
      return { userId, ...result };
    })
  );

  let created = 0;
  const failures: { userId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push({ userId: users[i].userId, error: String(r.reason) });
    } else {
      created += r.value.created;
    }
  });

  return NextResponse.json({ checked: users.length, created, failures });
}
