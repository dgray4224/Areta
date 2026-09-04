import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getMonthPacing } from "@/domains/review/month-pacing-service";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Bearer-authenticated month-pacing read for the mobile You tab — how the
 * month in progress compares to the same point in the user's recent
 * months (see domains/review/month-pacing.ts for the honesty rules).
 * `?month=YYYY-MM` reads a past month; default is the user's current
 * local month. Same auth pattern as app/api/review/energy-balance.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const monthParam = request.nextUrl.searchParams.get("month");
  if (monthParam !== null && !MONTH_PATTERN.test(monthParam)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const result = await getMonthPacing(userId, supabase, monthParam);
  return NextResponse.json(result);
}
