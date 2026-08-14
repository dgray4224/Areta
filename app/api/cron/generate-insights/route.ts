import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { localDateString } from "@/domains/activity-summary/timezone";
import { computeAndStoreInsights, type CreatedInsight } from "@/domains/insights/service";
import { sendPushToUsers } from "@/platform/push/send";

/** Only celebration-shaped insights earn a push (a statistical pattern is
 * better discovered in-app with its context around it), and only above
 * this score — a push interrupts; it has to be worth it. */
const PUSHABLE_TYPES = new Set(["personal_record", "behavior_streak"]);
const PUSH_MIN_SCORE = 75;
/** At most one insight push per user per rolling week, tracked via
 * insights.pushed_at (see the insights_pushed_at migration). */
const PUSH_THROTTLE_DAYS = 7;

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "");
}

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
  const pushCandidates: { userId: string; insight: CreatedInsight }[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push({ userId: users[i].userId, error: String(r.reason) });
    } else {
      created += r.value.created;
      const best = r.value.createdInsights
        .filter((insight) => PUSHABLE_TYPES.has(insight.type) && insight.score >= PUSH_MIN_SCORE)
        .sort((a, b) => b.score - a.score)[0];
      if (best) pushCandidates.push({ userId: r.value.userId, insight: best });
    }
  });

  // Throttle to <=1 insight push per user per rolling week, then send one
  // batched Expo request for everyone left -- best-effort, never fails the
  // cron (same posture as generate-weekly-reviews' push hook).
  let pushed = 0;
  if (pushCandidates.length > 0) {
    const throttleCutoff = new Date(Date.now() - PUSH_THROTTLE_DAYS * 86_400_000).toISOString();
    const { data: recentlyPushed } = await supabase
      .from("insights")
      .select("user_id")
      .in(
        "user_id",
        pushCandidates.map((c) => c.userId)
      )
      .gte("pushed_at", throttleCutoff);
    const throttledUserIds = new Set((recentlyPushed ?? []).map((row) => row.user_id));

    const toPush = pushCandidates.filter((c) => !throttledUserIds.has(c.userId));
    if (toPush.length > 0) {
      await sendPushToUsers(
        toPush.map(({ userId, insight }) => ({
          userId,
          title: "New about you",
          body: stripMarkdown(insight.headline),
          screen: "insights" as const,
        })),
        supabase
      );
      const now = new Date().toISOString();
      await supabase
        .from("insights")
        .update({ pushed_at: now })
        .in(
          "id",
          toPush.map(({ insight }) => insight.id)
        );
      pushed = toPush.length;
    }
  }

  return NextResponse.json({ checked: users.length, created, pushed, failures });
}
