import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getGoalById } from "@/domains/goals/service";

/** Bearer-authenticated single-goal lookup, including target/baseline
 * fields -- powers both the web and mobile goal-target edit form's
 * prefill. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;
  const { goalId } = await params;

  const goal = await getGoalById(userId, goalId, supabase);
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }
  return NextResponse.json(goal);
}
