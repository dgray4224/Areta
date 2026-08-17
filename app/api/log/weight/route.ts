import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { logWeight } from "@/domains/weight/service";

/**
 * Bearer-authenticated manual weight entry -- the mobile Log screen's
 * counterpart to web's /log/weight form, which is a server action and so
 * unreachable from a native client.
 *
 * Deliberately routes through logWeight rather than inserting directly:
 * that function writes through insertManualHealthMetric (the same
 * user_override-aware path a HealthKit re-import has to respect) and then
 * recomputes the activity daily summary. A raw insert from mobile would
 * skip both.
 *
 * Backdating is a first-class case, not an edge case: `loggedAt` is
 * whatever the client sends, so a user catching up after a few days away
 * gets their weight booked on the day they actually weighed in.
 */
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await logWeight(userId, body, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
