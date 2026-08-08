import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getGroceryListForWeek, toggleGroceryItem } from "@/domains/grocery/service";
import { getPrepPlanForWeek } from "@/domains/prep/service";
import { getWeekDates } from "@/platform/ui/week-dates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

/**
 * Bearer-token-authenticated endpoint for the mobile Plan tab's "Grocery
 * & Prep" sub-tab. Both artifacts are keyed off the *meal plan's* actual
 * week_start (stamped at generation time, not necessarily today's exact
 * date -- see currentWeekStart's own non-normalized definition in both
 * domains/grocery/service.ts and domains/prep/service.ts), and both are
 * only ever auto-generated as a cascade of approving that week's meal
 * plan (approveMealPlanAndGenerateDownstream) -- so this resolves the
 * same way /api/plan's resolveWeekStart does: bounded to the Sun-Sat
 * week containing `?week=` (default today), matched against the
 * *active* meal_plans row, not a naive exact-date match.
 *
 * getGroceryListForWeek/getPrepPlanForWeek/toggleGroceryItem didn't
 * previously accept an optional client -- unlike mealplan/workoutplan's
 * service functions, they always called the cookie-based createClient(),
 * which has no session for a bearer-authenticated mobile request. Added
 * the same optional-client param those already use (domains/grocery/
 * service.ts, domains/prep/service.ts) so this route's bearer-scoped
 * client actually gets used instead of silently hitting an empty
 * cookie-less session.
 */

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveMealWeekStart(
  userId: string,
  weekDates: string[],
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("week_start")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("week_start", weekDates[0])
    .lte("week_start", weekDates[6])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return plan?.week_start ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const anchor = request.nextUrl.searchParams.get("week") ?? todayDateString();
  const weekDates = getWeekDates(anchor);
  const mealWeekStart = await resolveMealWeekStart(userId, weekDates, supabase);

  if (!mealWeekStart) {
    return NextResponse.json({ hasMealPlan: false, groceryItems: [], prepPlan: null });
  }

  const [groceryItems, prepPlan] = await Promise.all([
    getGroceryListForWeek(userId, mealWeekStart, supabase),
    getPrepPlanForWeek(userId, mealWeekStart, supabase),
  ]);

  return NextResponse.json({ hasMealPlan: true, groceryItems, prepPlan });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { itemId?: unknown; isChecked?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.itemId !== "string" || typeof body.isChecked !== "boolean") {
    return NextResponse.json({ error: "itemId (string) and isChecked (boolean) are required" }, { status: 400 });
  }

  const result = await toggleGroceryItem(userId, body.itemId, body.isChecked, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
