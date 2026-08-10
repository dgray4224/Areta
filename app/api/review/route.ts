import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getReviewSummaryBundle } from "@/domains/review/service";

/**
 * Bearer-authenticated bundle for the mobile Review tab — everything the
 * AI Summary/Plan Recap/Vitals/Streaks/Check-in sub-tabs need in one round
 * trip, so switching between them doesn't each fire a separate request.
 * getReviewSummaryBundle is shared with the web app's own /review pages
 * (see domains/review/service.ts) so the two assemble this bundle
 * identically.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const bundle = await getReviewSummaryBundle(userId, supabase);
  return NextResponse.json(bundle);
}
