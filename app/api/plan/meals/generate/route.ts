import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { generateAndSaveMealPlanWeeks } from "@/domains/mealplan/approve-flow";
import { RECIPE_CUISINES } from "@/domains/recipes/schema";
import type { RecipeCuisine } from "@/domains/recipes/types";

/**
 * Bearer-token-authenticated endpoint for the mobile Plan tab's
 * "Customize this week" sheet (Phase G) -- generates `weeks` consecutive
 * meal plans starting from the current week and auto-approves each one
 * (cascading to grocery/prep), matching what onboarding already does for
 * a single week. Soft cuisine preference only, per
 * domains/mealplan/generate.ts's own documented never-a-hard-filter
 * contract -- an unrecognized cuisine string is dropped rather than
 * rejecting the whole request, same reasoning.
 */
const MAX_WEEKS = 8;

function isRecipeCuisine(value: unknown): value is RecipeCuisine {
  return typeof value === "string" && (RECIPE_CUISINES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { weeks?: unknown; preferredCuisines?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const weeks = typeof body.weeks === "number" && Number.isInteger(body.weeks) ? body.weeks : 1;
  if (weeks < 1 || weeks > MAX_WEEKS) {
    return NextResponse.json({ error: `weeks must be an integer between 1 and ${MAX_WEEKS}` }, { status: 400 });
  }

  const preferredCuisines = Array.isArray(body.preferredCuisines)
    ? body.preferredCuisines.filter(isRecipeCuisine)
    : undefined;

  const result = await generateAndSaveMealPlanWeeks(userId, { weeks, preferredCuisines }, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, warnings: result.data.warnings });
}
