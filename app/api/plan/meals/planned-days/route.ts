import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";

/**
 * Reads and updates `plannedMealDays` -- which weekdays the user wants
 * meals planned on (0 = Sunday .. 6 = Saturday).
 *
 * This is a standing preference, not a per-week chore: "I eat out at
 * weekends" is a fact about someone's life, and before this the only way
 * to express it was to delete the unwanted days again every single week
 * (and there was no delete path at all). Generation skips unplanned days,
 * and the grocery list follows automatically because it is derived from
 * meal_plan_items.
 *
 * Deliberately NOT routed through POST /api/onboarding/nutrition, which
 * validates and rewrites the entire nutrition blob -- sending this one
 * field there would blank out height, weight, allergies and everything
 * else the user answered. This merges into the existing jsonb instead.
 */
function isDayList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(value).size === value.length
  );
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const { data, error } = await supabase
    .from("onboarding_responses")
    .select("nutrition")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nutrition = (data?.nutrition ?? {}) as { plannedMealDays?: number[] };
  // Absent means every day -- the behaviour every pre-existing user
  // already has, so nothing needed backfilling.
  return NextResponse.json({ plannedMealDays: nutrition.plannedMealDays ?? [0, 1, 2, 3, 4, 5, 6] });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { plannedMealDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isDayList(body.plannedMealDays)) {
    return NextResponse.json(
      { error: "plannedMealDays must be an array of distinct integers 0-6" },
      { status: 400 }
    );
  }

  const { data: existing, error: readError } = await supabase
    .from("onboarding_responses")
    .select("nutrition")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!existing) {
    return NextResponse.json({ error: "Complete onboarding before setting meal preferences." }, { status: 400 });
  }

  const merged = {
    ...((existing.nutrition ?? {}) as Record<string, unknown>),
    plannedMealDays: [...body.plannedMealDays].sort((a, b) => a - b),
  };

  const { error: writeError } = await supabase
    .from("onboarding_responses")
    .update({ nutrition: merged })
    .eq("user_id", userId);
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  return NextResponse.json({ ok: true, plannedMealDays: merged.plannedMealDays });
}
