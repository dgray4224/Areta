import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getConsolidatedGroceryList } from "@/domains/grocery/service";

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bearer-token-authenticated endpoint for the mobile Grocery & Prep
 * sub-tab's per-visit "show groceries for N weeks" control -- a separate
 * route from /api/plan/grocery-prep (not an added param on it) because
 * the response shape is genuinely different: consolidated items carry no
 * `id`/`isChecked` (nothing is persisted, see
 * domains/grocery/service.ts#getConsolidatedGroceryList) and there's no
 * `prepPlan` concept for a multi-week span (prep is a single Sunday
 * session by design, out of scope here).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const weekStart = request.nextUrl.searchParams.get("weekStart");
  if (!weekStart || !WEEK_START_PATTERN.test(weekStart)) {
    return NextResponse.json({ error: "weekStart query param must be a YYYY-MM-DD date string" }, { status: 400 });
  }
  const weeksParam = request.nextUrl.searchParams.get("weeks");
  const weeks = weeksParam !== null && Number.isInteger(Number(weeksParam)) ? Number(weeksParam) : 1;

  const result = await getConsolidatedGroceryList(userId, weekStart, weeks, supabase);
  return NextResponse.json(result);
}
