import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { clearMealPlanDays } from "@/domains/mealplan/customize";
import { MEAL_TYPES, type MealType } from "@/domains/mealplan/generate";

/**
 * Removes planned meals from a week. Before 2026-08-16 there was no way
 * to do this -- not through the app, not through the API -- which is why
 * "I only cook Mon-Fri, and I want the grocery list to say so" was
 * unsatisfiable.
 *
 * Two granularities, chosen by whether `mealType` is present:
 *   { weekStart, daysOfWeek }             -> clear those whole days
 *   { weekStart, daysOfWeek, mealType }   -> clear just that slot
 *
 * The grocery list needs no argument here: it is derived from
 * meal_plan_items, so removing items is the whole mechanism. The domain
 * function regenerates the already-materialized grocery and prep rows so
 * the change is visible immediately rather than at the next approval.
 *
 * Clearing a week that has no plan is a success, not an error -- the
 * requested end state already holds.
 */
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { weekStart?: unknown; daysOfWeek?: unknown; mealType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.weekStart !== "string" || !WEEK_START_PATTERN.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date string" }, { status: 400 });
  }
  if (
    !Array.isArray(body.daysOfWeek) ||
    body.daysOfWeek.length === 0 ||
    !body.daysOfWeek.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
  ) {
    return NextResponse.json({ error: "daysOfWeek must be a non-empty array of integers 0-6" }, { status: 400 });
  }
  if (body.mealType !== undefined && !isMealType(body.mealType)) {
    return NextResponse.json({ error: `mealType must be one of: ${MEAL_TYPES.join(", ")}` }, { status: 400 });
  }

  const result = await clearMealPlanDays(
    userId,
    { weekStart: body.weekStart, daysOfWeek: body.daysOfWeek, mealType: body.mealType },
    supabase
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings, removed: result.data.removed });
}
