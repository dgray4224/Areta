import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { assignMealPlanDays } from "@/domains/mealplan/customize";
import { MEAL_TYPES, type MealType } from "@/domains/mealplan/generate";

/**
 * Bearer-token-authenticated endpoint for the mobile Plan tab's redesigned
 * "Customize this week" meal flow -- assigns one recipe to one or more
 * days of one week for a given meal type. Called once per recipe/day-set
 * round the user builds up (e.g. three separate calls for three distinct
 * lunches across a week), not a single batched save -- each call is a
 * complete, independently-valid assignment. See
 * domains/mealplan/customize.ts#assignMealPlanDays for the bootstrap +
 * write + pick-history + downstream-regen logic.
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

  let body: { weekStart?: unknown; recipeId?: unknown; mealType?: unknown; daysOfWeek?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.weekStart !== "string" || !WEEK_START_PATTERN.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date string" }, { status: 400 });
  }
  if (typeof body.recipeId !== "string" || body.recipeId.length === 0) {
    return NextResponse.json({ error: "recipeId is required" }, { status: 400 });
  }
  if (!isMealType(body.mealType)) {
    return NextResponse.json({ error: `mealType must be one of: ${MEAL_TYPES.join(", ")}` }, { status: 400 });
  }
  if (
    !Array.isArray(body.daysOfWeek) ||
    body.daysOfWeek.length === 0 ||
    !body.daysOfWeek.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
  ) {
    return NextResponse.json({ error: "daysOfWeek must be a non-empty array of integers 0-6" }, { status: 400 });
  }

  const result = await assignMealPlanDays(
    userId,
    { weekStart: body.weekStart, recipeId: body.recipeId, mealType: body.mealType, daysOfWeek: body.daysOfWeek },
    supabase
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings, displaced: result.data.displaced });
}
