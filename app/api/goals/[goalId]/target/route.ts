import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { setGoalTarget } from "@/domains/goals/service";

/**
 * Bearer-authenticated set/edit/clear of a goal's numeric target -- the
 * only way to do this outside onboarding's Goals step (see
 * domains/goals/service.ts#setGoalTarget's own doc comment). Both the web
 * edit form (via a thin Server Action wrapper) and the mobile edit modal
 * call this same route, so the two platforms can never disagree about the
 * re-baseline rule.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;
  const { goalId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await setGoalTarget(userId, goalId, body, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
