import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getExerciseHistory } from "@/domains/workout/history";

const DAYS = 7;

/**
 * Bearer-authenticated read of the last 7 days of HealthKit-synced workout
 * activity (mobile Exercise tab's analytics chart). getExerciseHistory is
 * shared with the web app's own exercise domain page (see
 * domains/workout/history.ts) so both aggregate the same way.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const days = await getExerciseHistory(userId, DAYS, supabase);
  return NextResponse.json({ days });
}
