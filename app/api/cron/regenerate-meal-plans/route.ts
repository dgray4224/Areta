import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";

/**
 * DISABLED (2026-08-16). Meal plans are no longer generated automatically.
 *
 * This cron used to keep a rolling SELF_SERVICE_WEEKS_AHEAD window of
 * weeks generated and auto-activated. That is exactly the behaviour users
 * asked us to remove: it filled in days they had no intention of cooking
 * (weekends spent eating out, say), and since there was no way to delete a
 * planned meal, the only recourse was to live with a grocery list that
 * did not match how they actually eat.
 *
 * A week of meals is now produced only when the user explicitly asks, via
 * POST /api/plan/meals/generate. Its schedule has been removed from
 * vercel.json, so nothing should reach this route at all.
 *
 * The route is kept rather than deleted so that (a) a stray scheduled
 * invocation from a cached config fails safe instead of 404-ing, and
 * (b) the reasoning stays attached to the thing it explains. The
 * workout-side sibling (regenerate-workout-plans) is UNAFFECTED and still
 * runs -- this decision was about meals only.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Automatic meal-plan generation is disabled; users generate a week explicitly.",
  });
}
