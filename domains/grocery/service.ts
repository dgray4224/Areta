"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { getMealPlanForWeek } from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { generateGroceryList, type IngredientNeed, type GroceryItemDraft } from "@/domains/grocery/generate";
import { todayForUser } from "@/domains/activity-summary/service";
import { addDays } from "@/platform/ui/week-dates";

/** Ingredient needs for one week's already-loaded meal plan, scaled by
 * each item's servings -- shared by generateAndSaveGroceryList (single
 * week, materialized) and getConsolidatedGroceryList (N weeks, read-only)
 * so both feed the same downstream generateGroceryList dedup/inventory
 * logic identically. */
async function gatherIngredientNeeds(
  plan: NonNullable<Awaited<ReturnType<typeof getMealPlanForWeek>>>,
  supabase: SupabaseClient<Database>
): Promise<IngredientNeed[]> {
  const recipeIds = [...new Set(plan.items.map((i) => i.recipeId))];
  const recipes = await getRecipesByIds(recipeIds, supabase);

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
  return needs;
}

/**
 * Operates on whichever meal plan was most recently made active, not a
 * hardcoded "this week" -- same reasoning as
 * domains/mealplan/service.ts#approveMealPlan's own fix: this runs
 * immediately after approval as part of approveMealPlanAndGenerateDownstream,
 * for whatever week that approval just targeted (today, or a future week
 * generated ahead of time via generateAndSaveMealPlanWeeks). That
 * "most recently active" resolution is only a fallback now -- pass
 * `weekStart` explicitly when regenerating for a specific week (e.g.
 * domains/mealplan/customize.ts#assignMealPlanDays editing a future or
 * past week's picks) so this never silently regenerates *today's* list
 * instead of the week actually being edited.
 */
export async function generateAndSaveGroceryList(
  userId: string,
  client?: SupabaseClient<Database>,
  weekStart?: string
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  let resolvedWeekStart = weekStart;
  if (!resolvedWeekStart) {
    const { data: activePlanRow } = await supabase
      .from("meal_plans")
      .select("week_start")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedWeekStart = activePlanRow?.week_start ?? (await todayForUser(supabase, userId));
  }
  const plan = await getMealPlanForWeek(userId, resolvedWeekStart, supabase);
  if (!plan || plan.items.length === 0) {
    return { ok: false, error: "Generate and approve a meal plan first." };
  }

  const needs = await gatherIngredientNeeds(plan, supabase);

  const { data: inventoryRows } = await supabase
    .from("inventory_items")
    .select("name, quantity, unit")
    .eq("user_id", userId);

  const items = generateGroceryList(needs, inventoryRows ?? []);

  const { data: list, error: listError } = await supabase
    .from("grocery_lists")
    .upsert(
      { user_id: userId, meal_plan_id: plan.id, week_start: resolvedWeekStart, status: "active" },
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
  weekStart?: string,
  client?: SupabaseClient<Database>
): Promise<GroceryItemView[]> {
  const supabase = client ?? (await createClient());
  const resolvedWeekStart = weekStart ?? (await todayForUser(supabase, userId));
  const { data: list } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", resolvedWeekStart)
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

const MAX_CONSOLIDATED_WEEKS = 8;

export type ConsolidatedGroceryList = {
  weeksIncluded: string[];
  /** Weeks in the requested span that had no meal plan (or an empty one)
   * -- surfaced so the UI can say "not included" rather than silently
   * under-counting. */
  weeksMissingPlan: string[];
  items: GroceryItemDraft[];
};

/**
 * Read-only, non-persisted grocery view spanning `weekCount` weeks
 * starting at `weekStart` -- the per-visit "I shop every N weeks"
 * control (Grocery & Prep tab), not a saved preference and not a new
 * grocery_lists row (that table's unique(user_id, week_start) stays
 * exactly as it is; this never writes anything). Merges every included
 * week's ingredient needs into one flat array and reuses the same
 * generateGroceryList dedup/inventory-subtraction pure function
 * generateAndSaveGroceryList already uses for a single week, so
 * consolidation behavior is identical to what a normal week's list
 * already does, just over a wider ingredient set.
 *
 * Deliberately does not attempt perishability splitting (e.g. "buy
 * produce next week instead") -- a known v1 simplification, not an
 * oversight; the merged totals are a straight sum across the span.
 */
export async function getConsolidatedGroceryList(
  userId: string,
  weekStart: string,
  weekCount: number,
  client?: SupabaseClient<Database>
): Promise<ConsolidatedGroceryList> {
  const supabase = client ?? (await createClient());
  const clampedWeeks = Math.min(Math.max(Math.round(weekCount), 1), MAX_CONSOLIDATED_WEEKS);

  const weeksIncluded: string[] = [];
  const weeksMissingPlan: string[] = [];
  const allNeeds: IngredientNeed[] = [];

  for (let i = 0; i < clampedWeeks; i++) {
    const week = i === 0 ? weekStart : addDays(weekStart, i * 7);
    const plan = await getMealPlanForWeek(userId, week, supabase);
    if (!plan || plan.items.length === 0) {
      weeksMissingPlan.push(week);
      continue;
    }
    weeksIncluded.push(week);
    allNeeds.push(...(await gatherIngredientNeeds(plan, supabase)));
  }

  const { data: inventoryRows } = await supabase
    .from("inventory_items")
    .select("name, quantity, unit")
    .eq("user_id", userId);

  const items = generateGroceryList(allNeeds, inventoryRows ?? []);

  return { weeksIncluded, weeksMissingPlan, items };
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
