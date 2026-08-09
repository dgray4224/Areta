import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { approveWeeklyReview } from "@/domains/review/approve-flow";

/** Bearer-authenticated trigger for mobile's approve/reject flow — thin
 * wrapper around the same approveWeeklyReview the web ApproveBriefButton
 * calls, including its full cascade (parameter recalculation, meal-plan
 * regeneration, weekly_outcomes rollover). Mobile gets the full flow, not
 * a read-only view, per this feature's decided scope. */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const rejectedRecommendationIds = Array.isArray(
    (body as { rejectedRecommendationIds?: unknown } | null)?.rejectedRecommendationIds
  )
    ? ((body as { rejectedRecommendationIds: unknown[] }).rejectedRecommendationIds.filter(
        (id): id is string => typeof id === "string"
      ))
    : [];

  const result = await approveWeeklyReview(userId, rejectedRecommendationIds, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
