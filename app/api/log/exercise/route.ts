import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { logExercise } from "@/domains/exercise/service";

/**
 * Bearer-authenticated freeform exercise entry for the mobile Log screen
 * -- an `exercise_logs` row for something the user did that wasn't on the
 * plan. Distinct from /api/exercise's PATCH, which ticks a planned item.
 * See /api/log/weight/route.ts for the shared rationale.
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

  const result = await logExercise(userId, body, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
