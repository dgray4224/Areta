import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getActiveGoalsWithTargets } from "@/domains/goals/service";

/**
 * Bearer-authenticated list of the user's active goals, including
 * target/baseline fields (unlike the web-only `getActiveGoals`, which
 * stays narrower for its one existing caller) -- powers the mobile
 * goal-target edit flow's "pick which goal to set/edit a target for"
 * screen, and can double as a general active-goals list for mobile.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const goals = await getActiveGoalsWithTargets(userId, supabase);
  return NextResponse.json({ goals });
}
