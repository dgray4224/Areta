"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { requireAdmin } from "@/platform/auth/admin";
import { logAdminAction } from "@/platform/audit/log";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { recipeSchema } from "@/domains/recipes/schema";
import type { Recipe, Ingredient, RecipeStatus } from "@/domains/recipes/types";

function toRecipe(row: Database["public"]["Tables"]["recipes"]["Row"]): Recipe {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type as Recipe["mealType"],
    // Every row has been backfilled/required to carry a cuisine since
    // migration 0096 — the DB column stays nullable only so a future
    // schema change can't be blocked by an in-flight insert missing it.
    cuisine: row.cuisine as Recipe["cuisine"],
    dishType: row.dish_type as Recipe["dishType"],
    alsoSuitableFor: (row.also_suitable_for ?? []) as Recipe["alsoSuitableFor"],
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    dietaryTags: row.dietary_tags,
    allergens: row.allergens as Recipe["allergens"],
    ingredients: row.ingredients as unknown as Ingredient[],
    instructions: row.instructions,
    storageInstructions: row.storage_instructions,
    photoUrl: row.photo_url,
    status: row.status as RecipeStatus,
  };
}

/** Only `status: 'active'` recipes — this is what real meal-plan
 * generation reads (domains/mealplan/service.ts), so a recipe an admin
 * is still drafting/reviewing never becomes eligible for a real user's
 * plan. Admin browsing across all statuses uses listRecipesAdmin below
 * instead. */
export async function getAllRecipes(client?: SupabaseClient<Database>): Promise<Recipe[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("recipes").select("*").eq("status", "active");

  if (error) {
    throw new Error(`Failed to load recipes: ${error.message}`);
  }

  return (data ?? []).map(toRecipe);
}

/** Unfiltered by status on purpose — resolves specific already-referenced
 * recipe ids (e.g. an existing meal plan's saved items), which should
 * still resolve even if the recipe was deprecated after the fact. */
export async function getRecipesByIds(
  ids: string[],
  client?: SupabaseClient<Database>
): Promise<Map<string, Recipe>> {
  if (ids.length === 0) return new Map();
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("recipes").select("*").in("id", ids);

  if (error) {
    throw new Error(`Failed to load recipes: ${error.message}`);
  }

  const map = new Map<string, Recipe>();
  for (const row of data ?? []) {
    map.set(row.id, toRecipe(row));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Admin content management (Phase C) — all statuses, plus writes
// ---------------------------------------------------------------------------

export async function listRecipesAdmin(
  status?: RecipeStatus,
  client?: SupabaseClient<Database>
): Promise<Recipe[]> {
  const supabase = client ?? (await createClient());
  let query = supabase.from("recipes").select("*").order("name", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load recipes: ${error.message}`);
  return (data ?? []).map(toRecipe);
}

export async function getRecipeAdmin(id: string, client?: SupabaseClient<Database>): Promise<Recipe | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load recipe: ${error.message}`);
  return data ? toRecipe(data) : null;
}

function toInsertRow(parsed: ReturnType<typeof recipeSchema.parse>) {
  return {
    name: parsed.name,
    meal_type: parsed.mealType,
    cuisine: parsed.cuisine,
    dish_type: parsed.dishType,
    also_suitable_for: parsed.alsoSuitableFor ?? [],
    calories: parsed.calories,
    protein_g: parsed.proteinG,
    carbs_g: parsed.carbsG,
    fat_g: parsed.fatG,
    fiber_g: parsed.fiberG ?? null,
    prep_minutes: parsed.prepMinutes,
    cook_minutes: parsed.cookMinutes,
    servings: parsed.servings,
    dietary_tags: parsed.dietaryTags,
    allergens: parsed.allergens,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    storage_instructions: parsed.storageInstructions || null,
    photo_url: parsed.photoUrl || null,
    status: parsed.status,
  };
}

export async function createRecipe(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .insert(toInsertRow(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function updateRecipe(id: string, input: unknown): Promise<ActionResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update(toInsertRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** No delete function, same reasoning as exercises: status: 'deprecated'
 * is the retirement mechanism, and a hard delete risks orphaning meal
 * plans/grocery lists/prep plans that already reference the row. */
export async function setRecipeStatus(id: string, status: RecipeStatus): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "recipe_status_changed",
    targetType: "recipe",
    targetId: id,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

export async function countRecipesByStatus(
  status: RecipeStatus,
  client?: SupabaseClient<Database>
): Promise<number> {
  const supabase = client ?? (await createClient());
  const { count } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}
