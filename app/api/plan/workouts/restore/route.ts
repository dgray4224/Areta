import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { restoreWorkoutPlanDays, type DisplacedWorkoutDay } from "@/domains/workoutplan/customize";

/**
 * Undo counterpart to /api/plan/workouts/assign-session and
 * /assign-exercise -- hands back the `displaced` snapshot either of them
 * returned so the mobile customizer's "This session's changes" list can
 * offer real edit and delete.
 *
 * Serves both assign paths with one route because the undo unit is the
 * same for both: a whole day's items (see DisplacedWorkoutDay). The
 * snapshot round-trips through the client since it's per-editing-session
 * state, not durable plan data; restoreWorkoutPlanDays overwrites
 * `user_id`/`workout_plan_id` from the authenticated session rather than
 * trusting the payload, so a doctored snapshot can't reach another
 * user's plan.
 */
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDisplacedDay(value: unknown): value is DisplacedWorkoutDay {
  if (typeof value !== "object" || value === null) return false;
  const day = value as { dayOfWeek?: unknown; items?: unknown };
  const dayOk = typeof day.dayOfWeek === "number" && Number.isInteger(day.dayOfWeek) && day.dayOfWeek >= 0 && day.dayOfWeek <= 6;
  // Item shape is validated by the insert itself (and by the DB's own
  // constraints) rather than re-declared field-by-field here -- this
  // route's job is to reject the wrong *kind* of payload, not to
  // duplicate the workout_plan_items schema.
  const itemsOk =
    Array.isArray(day.items) && day.items.every((item) => typeof item === "object" && item !== null && !Array.isArray(item));
  return dayOk && itemsOk;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { weekStart?: unknown; days?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.weekStart !== "string" || !WEEK_START_PATTERN.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date string" }, { status: 400 });
  }
  if (!Array.isArray(body.days) || !body.days.every(isDisplacedDay)) {
    return NextResponse.json({ error: "days must be an array of { dayOfWeek: 0-6, items: object[] }" }, { status: 400 });
  }

  const result = await restoreWorkoutPlanDays(userId, body.weekStart, body.days, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings });
}
