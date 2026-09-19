import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { sendOpsAlert } from "@/platform/alerts/notify";
import { assessWeeklyBriefHealth, STALE_AFTER_DAYS, type AiRunSample } from "@/domains/observability/ai-health";

/**
 * The watchdog. Runs daily and asks one question: is the weekly brief,
 * the thing this product exists to deliver, still being written?
 *
 * It exists because between 2026-08-23 and 2026-09-19 it was not, and
 * nobody found out for four weeks. `generate-weekly-reviews` now alerts
 * on its own failures, but that only helps while it is still running —
 * a cron that is disabled, misconfigured or silently dropped produces no
 * failures to report. This one reads the record instead of the run, so
 * absence is as loud as error.
 *
 * Two ways it makes noise, so neither depends on the other being set up:
 * a webhook alert, and a 500 that shows the invocation as failed in
 * Vercel's cron list.
 */

const LOOKBACK_DAYS = 30;

export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const [{ data: runs, error: runsError }, { count: eligibleUsers, error: usersError }] = await Promise.all([
    supabase
      .from("ai_runs")
      .select("created_at, success, error")
      .eq("purpose", "weekly_brief")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("weekly_review_day", "is", null)
      .not("onboarding_completed_at", "is", null),
  ]);

  // A watchdog that can't read its own inputs is itself a failure worth
  // hearing about, rather than a silent 200.
  if (runsError || usersError) {
    const detail = `Could not read health inputs: ${runsError?.message ?? usersError?.message}`;
    await sendOpsAlert({ subject: "Health check could not run", detail });
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }

  const samples: AiRunSample[] = (runs ?? []).map((r) => ({
    createdAt: r.created_at,
    success: r.success,
    error: r.error,
  }));

  const verdict = assessWeeklyBriefHealth({ runs: samples, eligibleUsers: eligibleUsers ?? 0 });

  if (!verdict.healthy) {
    await sendOpsAlert({ subject: verdict.reason ?? "Weekly brief unhealthy", detail: verdict.detail });
    return NextResponse.json({ ok: false, check: "weekly_brief", ...verdict, staleAfterDays: STALE_AFTER_DAYS }, { status: 500 });
  }

  return NextResponse.json({ ok: true, check: "weekly_brief", ...verdict });
}
