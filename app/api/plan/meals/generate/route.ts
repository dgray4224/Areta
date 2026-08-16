import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { generateAndSaveMealPlan } from "@/domains/mealplan/service";
import { RECIPE_CUISINES } from "@/domains/recipes/schema";
import type { RecipeCuisine } from "@/domains/recipes/types";

/**
 * "Auto-generate this week" -- as of 2026-08-16 the ONLY way a week of
 * meals comes into existence.
 *
 * Meal plans used to appear from four places: onboarding, weekly-review
 * approval, a daily cron, and as a silent side effect of customizing a
 * week that had no plan yet. All four are gone. They filled in days
 * people had no intention of cooking, and because no delete path existed
 * anywhere in the app or its API, the grocery list could not be made to
 * match how someone actually eats. Generation is now a button.
 *
 * Rewritten from generating N consecutive weeks to generating ONE named
 * week. Multi-week generation was the shape the removed cron needed;
 * a user pressing a button is always asking about the week in front of
 * them. `weeks` is still accepted and ignored so an older mobile build
 * calling this doesn't hard-fail.
 *
 * Respects the user's `plannedMealDays` preference (see
 * domains/nutrition/schema.ts) via generateAndSaveMealPlan: opted-out days
 * get no meals at all, and the grocery list follows automatically because
 * it is derived from meal_plan_items.
 *
 * `never_recommend` personalization is applied here, since the
 * review-approval path that used to apply it no longer generates.
 */
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecipeCuisine(value: unknown): value is RecipeCuisine {
  return typeof value === "string" && (RECIPE_CUISINES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { weekStart?: unknown; preferredCuisines?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.weekStart !== "string" || !WEEK_START_PATTERN.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart must be a YYYY-MM-DD date string" }, { status: 400 });
  }

  const preferredCuisines = Array.isArray(body.preferredCuisines)
    ? body.preferredCuisines.filter(isRecipeCuisine)
    : undefined;

  const { data: personalization } = await supabase
    .from("personalization_profiles")
    .select("never_recommend")
    .eq("user_id", userId)
    .maybeSingle();

  const result = await generateAndSaveMealPlan(
    userId,
    {
      weekStart: body.weekStart,
      preferredCuisines,
      // Matches the previous auto-activate policy: a freshly generated
      // week shows as calendar dots immediately rather than sitting in a
      // draft nothing ever approves.
      activateImmediately: true,
      extraExcludeKeywords: ((personalization?.never_recommend as string[] | null) ?? []).map((s) => s.toLowerCase()),
    },
    supabase
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings });
}
