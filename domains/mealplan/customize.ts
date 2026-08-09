"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { generateAndSaveMealPlan, getMealPlanForWeek } from "@/domains/mealplan/service";
import type { MealType } from "@/domains/mealplan/generate";
import { generateAndSaveGroceryList } from "@/domains/grocery/service";
import { generateAndSavePrepPlan } from "@/domains/prep/service";

/**
 * Backs the mobile "Customize this week" meal flow (pick a recipe, assign
 * it to specific days of a chosen week) -- distinct from
 * domains/mealplan/service.ts's CRUD, which is either whole-week
 * generation (destructive) or single-item edits with no day-assignment
 * concept. Kept in its own file since this is a different concern:
 * bootstrap + batch write + pick-history logging + downstream-regen
 * orchestration, not plain per-item CRUD.
 */
export type MealDayAssignmentInput = {
  weekStart: string;
  recipeId: string;
  mealType: MealType;
  /** 0-6 (Sun-Sat), the day(s) within `weekStart`'s week to assign this recipe to. */
  daysOfWeek: number[];
};

/**
 * Assigns one recipe to one or more days of one week for a given meal
 * type. Never regenerates a week that already has items -- only
 * bootstraps a missing week once (so "auto-fill the rest" happens via
 * the normal generator), then layers this pick on top by updating (or
 * inserting, if the slot doesn't already exist) exactly the targeted
 * `meal_plan_items` rows. Calling this multiple times for the same week
 * with different recipes/days is how a user builds up "3 distinct
 * lunches this week" -- each call only ever touches its own days, never
 * wipes an earlier call's picks.
 */
export async function assignMealPlanDays(
  userId: string,
  input: MealDayAssignmentInput,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const { weekStart, recipeId, mealType, daysOfWeek } = input;

  if (daysOfWeek.length === 0) {
    return { ok: false, error: "Pick at least one day to assign this to." };
  }
  if (daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, error: "Invalid day of week." };
  }

  // Bootstrap-if-missing: generateAndSaveMealPlan deletes+reinserts every
  // item for the week, so it's only safe to call when nothing has been
  // customized yet. A plan that already exists (whether from a prior
  // generation or an earlier round of this same customization pass) is
  // left untouched here -- this call only ever adds/updates the specific
  // slots it targets.
  //
  // activateImmediately: true (2026-08-09) -- without it, customizing a
  // future week with no existing plan would bootstrap a 'draft' that
  // nothing ever approves, so the customization would silently never show
  // up as calendar dots. Same self-service auto-activate policy as the
  // regenerate-meal-plans cron; harmless no-op for a trainer-assigned
  // user since generateAndSaveMealPlan's own guard already refuses to run
  // for them regardless of this flag.
  let warnings: string[] = [];
  const existingPlan = await getMealPlanForWeek(userId, weekStart, supabase);
  if (!existingPlan || existingPlan.items.length === 0) {
    const generateResult = await generateAndSaveMealPlan(userId, { weekStart, activateImmediately: true }, supabase);
    if (!generateResult.ok) return generateResult;
    warnings = generateResult.data.warnings;
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, meal_type, status")
    .eq("id", recipeId)
    .maybeSingle();
  if (recipeError) return { ok: false, error: recipeError.message };
  if (!recipe || recipe.status !== "active") {
    return { ok: false, error: "Recipe not found or no longer available." };
  }
  if (recipe.meal_type !== mealType) {
    return { ok: false, error: `This is a ${mealType} slot, but that recipe is ${recipe.meal_type}.` };
  }

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  if (!plan) return { ok: false, error: "No meal plan exists for that week." };

  const { data: existingItems, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select("id, day_of_week")
    .eq("meal_plan_id", plan.id)
    .eq("meal_type", mealType)
    .in("day_of_week", daysOfWeek);
  if (itemsError) return { ok: false, error: itemsError.message };

  const existingByDay = new Map((existingItems ?? []).map((i) => [i.day_of_week, i.id]));
  const daysToUpdate = daysOfWeek.filter((d) => existingByDay.has(d));
  const daysToInsert = daysOfWeek.filter((d) => !existingByDay.has(d));

  if (daysToUpdate.length > 0) {
    const itemIds = daysToUpdate.map((d) => existingByDay.get(d)!);
    const { error: updateError } = await supabase
      .from("meal_plan_items")
      .update({ recipe_id: recipeId })
      .in("id", itemIds);
    if (updateError) return { ok: false, error: updateError.message };
  }

  if (daysToInsert.length > 0) {
    const { error: insertError } = await supabase.from("meal_plan_items").insert(
      daysToInsert.map((day) => ({
        meal_plan_id: plan.id,
        user_id: userId,
        day_of_week: day,
        meal_type: mealType,
        recipe_id: recipeId,
        servings: 1,
      }))
    );
    if (insertError) return { ok: false, error: insertError.message };
  }

  const { error: historyError } = await supabase.from("meal_pick_history").insert(
    daysOfWeek.map((day) => ({
      user_id: userId,
      recipe_id: recipeId,
      meal_type: mealType,
      week_start: weekStart,
      day_of_week: day,
    }))
  );
  if (historyError) {
    // Pick-history is a preference signal, not plan content -- same
    // "non-fatal, warn only" treatment as workout_plan_item_alternatives
    // inserts (domains/workoutplan/service.ts), never blocks the actual
    // assignment that already succeeded above.
    warnings = [...warnings, `Preference tracking failed: ${historyError.message}`];
  }

  // Downstream refresh: only if this week was already approved (has a
  // materialized grocery/prep row) -- an edit to a not-yet-approved
  // future week is picked up normally by approveMealPlanAndGenerateDownstream
  // later, same as any other pre-approval edit.
  const [{ data: groceryRow }, { data: prepRow }] = await Promise.all([
    supabase.from("grocery_lists").select("id").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
    supabase.from("prep_plans").select("id").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
  ]);
  if (groceryRow) {
    const groceryResult = await generateAndSaveGroceryList(userId, supabase, weekStart);
    if (!groceryResult.ok) warnings = [...warnings, `Grocery list update failed: ${groceryResult.error}`];
  }
  if (prepRow) {
    const prepResult = await generateAndSavePrepPlan(userId, supabase, weekStart);
    if (!prepResult.ok) warnings = [...warnings, `Prep plan update failed: ${prepResult.error}`];
  }

  return { ok: true, data: { warnings } };
}
