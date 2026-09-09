import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { RECIPE_CUISINES } from "@/domains/recipes/schema";
import type { RecipeCuisine } from "@/domains/recipes/types";

/**
 * Reads and updates the two taste preferences the meal generator honours
 * on every rebuild: `preferredCuisines` (scored toward, never a filter)
 * and `dislikedFoods` (substring exclusions against recipe names and
 * ingredients). Asked once on the onboarding Food screen, edited in
 * Settings → Personalization.
 *
 * Like planned-days, this merges into the nutrition jsonb rather than
 * going through POST /api/onboarding/nutrition, which rewrites the whole
 * blob and would blank out height, weight, allergies and the rest.
 */
const MAX_DISLIKES = 30;
const MAX_DISLIKE_LENGTH = 40;

function isRecipeCuisine(value: unknown): value is RecipeCuisine {
  return typeof value === "string" && (RECIPE_CUISINES as readonly string[]).includes(value);
}

function parseCuisines(value: unknown): RecipeCuisine[] | null {
  if (!Array.isArray(value) || !value.every(isRecipeCuisine)) return null;
  return Array.from(new Set(value));
}

function parseDislikes(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) return null;
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of value as string[]) {
    const item = raw.trim();
    if (!item || item.length > MAX_DISLIKE_LENGTH) return null;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(item);
  }
  return cleaned.length > MAX_DISLIKES ? null : cleaned;
}

type StoredPreferences = { preferredCuisines?: RecipeCuisine[]; dislikedFoods?: string[] };

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

  const nutrition = (data?.nutrition ?? {}) as StoredPreferences;
  return NextResponse.json({
    preferredCuisines: parseCuisines(nutrition.preferredCuisines) ?? [],
    dislikedFoods: parseDislikes(nutrition.dislikedFoods) ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { preferredCuisines?: unknown; dislikedFoods?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: StoredPreferences = {};
  if (body.preferredCuisines !== undefined) {
    const cuisines = parseCuisines(body.preferredCuisines);
    if (!cuisines) {
      return NextResponse.json(
        { error: `preferredCuisines must be an array of: ${RECIPE_CUISINES.join(", ")}` },
        { status: 400 }
      );
    }
    patch.preferredCuisines = cuisines;
  }
  if (body.dislikedFoods !== undefined) {
    const dislikes = parseDislikes(body.dislikedFoods);
    if (!dislikes) {
      return NextResponse.json(
        { error: `dislikedFoods must be up to ${MAX_DISLIKES} non-empty strings of at most ${MAX_DISLIKE_LENGTH} characters` },
        { status: 400 }
      );
    }
    patch.dislikedFoods = dislikes;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Send preferredCuisines and/or dislikedFoods" }, { status: 400 });
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

  const merged = { ...((existing.nutrition ?? {}) as Record<string, unknown>), ...patch };

  const { error: writeError } = await supabase
    .from("onboarding_responses")
    .update({ nutrition: merged })
    .eq("user_id", userId);
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    preferredCuisines: (merged.preferredCuisines as RecipeCuisine[] | undefined) ?? [],
    dislikedFoods: (merged.dislikedFoods as string[] | undefined) ?? [],
  });
}
