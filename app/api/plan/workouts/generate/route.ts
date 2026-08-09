import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { generateAndSaveWorkoutPlanWeeks } from "@/domains/workoutplan/service";

/**
 * Bearer-token-authenticated endpoint for the mobile Plan tab's
 * "Customize this week" sheet (Phase G) -- generates `weeks` consecutive
 * workout plans starting from the current week and auto-approves each
 * one, letting resolveProgression see each prior week as it goes so
 * phase advancement (continue/advance/reselect) plays out the same as it
 * would week-by-week in real time. See
 * domains/workoutplan/service.ts#generateAndSaveWorkoutPlanWeeks.
 */
const MAX_WEEKS = 8;

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { weeks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const weeks = typeof body.weeks === "number" && Number.isInteger(body.weeks) ? body.weeks : 1;
  if (weeks < 1 || weeks > MAX_WEEKS) {
    return NextResponse.json({ error: `weeks must be an integer between 1 and ${MAX_WEEKS}` }, { status: 400 });
  }

  const result = await generateAndSaveWorkoutPlanWeeks(userId, weeks, undefined, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings });
}
