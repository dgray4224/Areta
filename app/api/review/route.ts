import { after, NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { ensureWeeklyBrief, getReviewSummaryBundle } from "@/domains/review/service";

/**
 * Bearer-authenticated bundle for the mobile Review tab — everything the
 * AI Summary/Plan Recap/Vitals/Streaks/Check-in sub-tabs need in one round
 * trip, so switching between them doesn't each fire a separate request.
 * getReviewSummaryBundle is shared with the web app's own /review pages
 * (see domains/review/service.ts) so the two assemble this bundle
 * identically.
 *
 * When the cycle has no brief yet, one is written in the background
 * rather than on the request: generating it takes long enough that
 * blocking here would turn opening the tab into a ten-second wait. The
 * response says `briefStatus: "pending"` and the client shows the
 * figures it already has meanwhile, then refreshes. Until 2026-09-26 the
 * daily cron was the only trigger, so anyone who installed mid-week, or
 * whose review-day generation failed, simply never got one.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const bundle = await getReviewSummaryBundle(userId, supabase);

  if (bundle.briefStatus === "pending") {
    after(async () => {
      try {
        await ensureWeeklyBrief(userId, supabase);
      } catch (error) {
        // ai_runs already records the failure and its reason; this is
        // only so a throw in here can't take the response down with it.
        console.error("[review] background brief generation failed:", error);
      }
    });
  }

  return NextResponse.json(bundle);
}
