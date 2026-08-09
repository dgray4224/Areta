import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { assignWorkoutPlanExerciseDays } from "@/domains/workoutplan/customize";

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bearer-token-authenticated endpoint for the mobile Plan tab's redesigned
 * "Customize this week" workout flow -- legacy/goal-first plans only
 * (no session concept, assigns a single free-library exercise to one or
 * more days). See domains/workoutplan/customize.ts#assignWorkoutPlanExerciseDays.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: {
    weekStart?: unknown;
    exerciseId?: unknown;
    sets?: unknown;
    reps?: unknown;
    durationMinutes?: unknown;
    daysOfWeek?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.weekStart !== "string" || !WEEK_START_PATTERN.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date string" }, { status: 400 });
  }
  if (typeof body.exerciseId !== "string" || body.exerciseId.length === 0) {
    return NextResponse.json({ error: "exerciseId is required" }, { status: 400 });
  }
  if (
    !Array.isArray(body.daysOfWeek) ||
    body.daysOfWeek.length === 0 ||
    !body.daysOfWeek.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
  ) {
    return NextResponse.json({ error: "daysOfWeek must be a non-empty array of integers 0-6" }, { status: 400 });
  }
  const sets = typeof body.sets === "number" ? body.sets : null;
  const reps = typeof body.reps === "number" ? body.reps : null;
  const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : null;

  const result = await assignWorkoutPlanExerciseDays(
    userId,
    body.weekStart,
    { exerciseId: body.exerciseId, sets, reps, durationMinutes },
    body.daysOfWeek,
    supabase
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings });
}
