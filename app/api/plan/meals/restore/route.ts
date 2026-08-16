import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { restoreMealPlanDays, type DisplacedMealSlot } from "@/domains/mealplan/customize";
import { MEAL_TYPES, type MealType } from "@/domains/mealplan/generate";

/**
 * Undo counterpart to /api/plan/meals/assign -- takes back the `displaced`
 * payload that call returned and puts those slots back, so the mobile
 * customizer's "This session's changes" list can offer real edit and
 * delete instead of being an append-only log.
 *
 * The client is the one holding the snapshot (it's per-editing-session
 * state, not durable plan data), so it round-trips through the request
 * body rather than living in a server-side undo table. That means a
 * caller could post an arbitrary recipeId here -- which is exactly what
 * assign already allows, and lands under the same RLS + explicit
 * user_id filters, so it grants no reach a user doesn't already have
 * over their own plan.
 */
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

function isDisplacedSlot(value: unknown): value is DisplacedMealSlot {
  if (typeof value !== "object" || value === null) return false;
  const slot = value as { dayOfWeek?: unknown; recipeId?: unknown };
  const dayOk = typeof slot.dayOfWeek === "number" && Number.isInteger(slot.dayOfWeek) && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6;
  const recipeOk = slot.recipeId === null || (typeof slot.recipeId === "string" && slot.recipeId.length > 0);
  return dayOk && recipeOk;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { weekStart?: unknown; mealType?: unknown; slots?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.weekStart !== "string" || !WEEK_START_PATTERN.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date string" }, { status: 400 });
  }
  if (!isMealType(body.mealType)) {
    return NextResponse.json({ error: `mealType must be one of: ${MEAL_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!Array.isArray(body.slots) || !body.slots.every(isDisplacedSlot)) {
    return NextResponse.json(
      { error: "slots must be an array of { dayOfWeek: 0-6, recipeId: string | null }" },
      { status: 400 }
    );
  }

  const result = await restoreMealPlanDays(
    userId,
    { weekStart: body.weekStart, mealType: body.mealType, slots: body.slots },
    supabase
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings });
}
