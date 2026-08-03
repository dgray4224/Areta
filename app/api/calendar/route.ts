import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getUpcomingEventsWithTimeout } from "@/domains/calendar/events-service";

/**
 * Bearer-token-authenticated read endpoint for the mobile Calendar tab.
 * Reuses the exact same getUpcomingEventsWithTimeout the web dashboard's
 * "Upcoming events" section already calls (same 3-second-timeout, never-
 * throws behavior) — no separate calendar logic for mobile.
 */

const DEFAULT_DAYS_AHEAD = 7;

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const daysParam = request.nextUrl.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : DEFAULT_DAYS_AHEAD;
  const daysAhead = Number.isFinite(days) && days > 0 ? days : DEFAULT_DAYS_AHEAD;

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const events = await getUpcomingEventsWithTimeout(userId, { timeMin, timeMax }, supabase);

  return NextResponse.json({ events });
}
