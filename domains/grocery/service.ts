"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { getMealPlanForWeek } from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { generateGroceryList, type IngredientNeed } from "@/domains/grocery/generate";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateAndSaveGroceryList(userId: string, client?: SupabaseClient<Database>): Promise<ActionResult> {
  const weekStart = currentWeekStart();
  const plan = await getMealPlanForWeek(userId, weekStart, client);
  if (!plan || plan.items.length === 0) {
    return { ok: false, error: "Generate and approve a meal plan first." };
  }

  const recipeIds = [...new Set(plan.items.map((i) => i.recipeId))];
  const recipes = await getRecipesByIds(recipeIds, client);

  const needs: IngredientNeed[] = [];
  for (const item of plan.items) {
    const recipe = recipes.get(item.recipeId);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      needs.push({
        name: ingredient.name,
        quantity: ingredient.quantity * item.servings,
        unit: ingredient.unit,
        section: ingredient.section,
        recipeName: recipe.name,
      });
    }
  }

  const supabase = client ?? (await createClient());
  const { data: inventoryRows } = await supabase
    .from("inventory_items")
    .select("name, quantity, unit")
    .eq("user_id", userId);

  const items = generateGroceryList(needs, inventoryRows ?? []);

  const { data: list, error: listError } = await supabase
    .from("grocery_lists")
    .upsert(
      { user_id: userId, meal_plan_id: plan.id, week_start: weekStart, status: "active" },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();

  if (listError || !list) {
    return { ok: false, error: `Failed to save grocery list: ${listError?.message}` };
  }

  const { error: deleteError } = await supabase
    .from("grocery_items")
    .delete()
    .eq("grocery_list_id", list.id);
  if (deleteError) {
    return { ok: false, error: `Failed to clear previous grocery items: ${deleteError.message}` };
  }

  if (items.length > 0) {
    const { error: insertError } = await supabase.from("grocery_items").insert(
      items.map((item) => ({
        grocery_list_id: list.id,
        user_id: userId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        section: item.section,
        needed_for: item.neededFor,
      }))
    );
    if (insertError) {
      return { ok: false, error: `Failed to save grocery items: ${insertError.message}` };
    }
  }

  return { ok: true, data: undefined };
}

export type GroceryItemView = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  section: string;
  neededFor: string[];
  isChecked: boolean;
};

export async function getGroceryListForWeek(
  userId: string,
  weekStart = currentWeekStart(),
  client?: SupabaseClient<Database>
): Promise<GroceryItemView[]> {
  const supabase = client ?? (await createClient());
  const { data: list } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!list) return [];

  const { data: items, error } = await supabase
    .from("grocery_items")
    .select("id, name, quantity, unit, section, needed_for, is_checked")
    .eq("grocery_list_id", list.id)
    .order("section", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load grocery items: ${error.message}`);
  }

  return (items ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    section: i.section,
    neededFor: i.needed_for,
    isChecked: i.is_checked,
  }));
}

export async function toggleGroceryItem(
  userId: string,
  itemId: string,
  isChecked: boolean,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("grocery_items")
    .update({ is_checked: isChecked })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
