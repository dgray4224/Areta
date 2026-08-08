import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import {
  getActiveMealPlan,
  setMealPlanItemCompleted,
  setMealPlanItemScheduledTime,
  setMealPlanItemNotes,
} from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { logNutrition, getNutritionLogsForDate, getNutritionDailyTotals } from "@/domains/nutrition/log-service";

/**
 * Bearer-token-authenticated read/write endpoint for the mobile Nutrition
 * tab (CLAUDE.md §14/§15). GET returns today's (or ?date=) planned meals
 * (from the active meal plan, filtered to that day-of-week) plus that
 * day's logged entries and recent daily totals. POST logs a freeform food
 * entry for anything off-plan (mirrors the web app's own log form
 * exactly). PATCH marks a planned meal eaten -- captures the recipe's
 * known macros into a nutrition_logs row automatically, see
 * setMealPlanItemCompleted.
 */

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayOfWeekFor(dateString: string): number {
  return new Date(`${dateString}T00:00:00Z`).getUTCDay();
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const date = request.nextUrl.searchParams.get("date") ?? todayDateString();

  const plan = await getActiveMealPlan(userId, supabase);
  const dow = dayOfWeekFor(date);
  const todaysItems = plan?.items.filter((item) => item.dayOfWeek === dow) ?? [];
  const recipeMap = await getRecipesByIds(
    todaysItems.map((item) => item.recipeId),
    supabase
  );

  const plannedMeals = todaysItems.map((item) => {
    const recipe = recipeMap.get(item.recipeId);
    return {
      id: item.id,
      recipeName: recipe?.name ?? "Unknown recipe",
      cuisine: recipe?.cuisine ?? null,
      allergens: recipe?.allergens ?? [],
      mealType: item.mealType,
      servings: item.servings,
      completedAt: item.completedAt,
      scheduledTime: item.scheduledTime,
      endTime: item.endTime,
      notes: item.notes,
    };
  });

  let logs: Awaited<ReturnType<typeof getNutritionLogsForDate>>;
  let totals: Awaited<ReturnType<typeof getNutritionDailyTotals>>;
  try {
    [logs, totals] = await Promise.all([
      getNutritionLogsForDate(userId, date, supabase),
      getNutritionDailyTotals(userId, 30, supabase),
    ]);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load nutrition data" }, { status: 500 });
  }

  return NextResponse.json({ plan: plannedMeals, logs, totals });
}

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

  const result = await logNutrition(userId, body, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { itemId?: unknown; completed?: unknown; scheduledTime?: unknown; endTime?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.itemId !== "string") {
    return NextResponse.json({ error: "itemId (string) is required" }, { status: 400 });
  }
  const hasCompleted = typeof body.completed === "boolean";
  const hasScheduledTime = typeof body.scheduledTime === "string" || body.scheduledTime === null;
  const hasEndTime = typeof body.endTime === "string" || body.endTime === null;
  const hasNotes = typeof body.notes === "string" || body.notes === null;
  if (!hasCompleted && !hasScheduledTime && !hasNotes) {
    return NextResponse.json(
      {
        error:
          "at least one of completed (boolean), scheduledTime (string | null), or notes (string | null) is required",
      },
      { status: 400 }
    );
  }

  if (hasCompleted) {
    const result = await setMealPlanItemCompleted(userId, body.itemId, body.completed as boolean, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  if (hasScheduledTime) {
    // endTime is only honored alongside scheduledTime -- an explicit
    // window from the edit sheet's start+end pickers. Omitted entirely,
    // it falls back to the auto-preserve-shift used by dragging.
    const result = await setMealPlanItemScheduledTime(
      userId,
      body.itemId,
      body.scheduledTime as string | null,
      supabase,
      hasEndTime ? (body.endTime as string | null) : undefined
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  if (hasNotes) {
    const result = await setMealPlanItemNotes(userId, body.itemId, body.notes as string | null, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
