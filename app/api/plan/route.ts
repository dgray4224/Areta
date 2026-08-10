import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getPlanRange } from "@/domains/plan/service";
import { getWeekDates } from "@/platform/ui/week-dates";
import { todayForUser } from "@/domains/activity-summary/service";

/**
 * Bearer-token-authenticated read endpoint for the mobile Plan tab.
 * Powers both the week-outlook view (`?week=`) and the month calendar
 * grid (`?start=&end=`, an arbitrary inclusive date range spanning
 * possibly several weeks). getPlanRange (domains/plan/service.ts) is
 * shared with web's own Plan calendar page, so the two compute the exact
 * same "what's planned on this date" answer instead of two
 * implementations. Editing an individual day's items still goes through
 * /api/nutrition and /api/exercise (the latter generalized to accept
 * ?date= alongside this route so edits aren't locked to today -- see
 * that route's own comment).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;
  const today = await todayForUser(supabase, userId);

  const params = request.nextUrl.searchParams;
  const explicitStart = params.get("start");
  const explicitEnd = params.get("end");
  const weekAnchorParam = params.get("week");

  const rangeStart = explicitStart ?? getWeekDates(weekAnchorParam ?? today)[0];
  const rangeEnd = explicitEnd ?? getWeekDates(weekAnchorParam ?? today)[6];

  const range = await getPlanRange(userId, rangeStart, rangeEnd, supabase);
  return NextResponse.json(range);
}
