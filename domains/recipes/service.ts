"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { Recipe, Ingredient } from "@/domains/recipes/types";

export async function getAllRecipes(): Promise<Recipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("*");

  if (error) {
    throw new Error(`Failed to load recipes: ${error.message}`);
  }

  return (data ?? []).map(
    (row): Recipe => ({
      id: row.id,
      name: row.name,
      mealType: row.meal_type as Recipe["mealType"],
      calories: row.calories,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      fiberG: row.fiber_g,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      servings: row.servings,
      dietaryTags: row.dietary_tags,
      ingredients: row.ingredients as unknown as Ingredient[],
      instructions: row.instructions,
      storageInstructions: row.storage_instructions,
    })
  );
}

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
    map.set(row.id, {
      id: row.id,
      name: row.name,
      mealType: row.meal_type as Recipe["mealType"],
      calories: row.calories,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      fiberG: row.fiber_g,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      servings: row.servings,
      dietaryTags: row.dietary_tags,
      ingredients: row.ingredients as unknown as Ingredient[],
      instructions: row.instructions,
      storageInstructions: row.storage_instructions,
    });
  }
  return map;
}
