"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getMealPlanForWeek } from "@/domains/mealplan/service";
import type { MealType } from "@/domains/mealplan/generate";
import { generateAndSaveGroceryList } from "@/domains/grocery/service";
import { generateAndSavePrepPlan } from "@/domains/prep/service";
import { getWeekDates } from "@/platform/ui/week-dates";

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

/** What one day's slot held before an assignment overwrote it.
 * `recipeId: null` = the slot didn't exist, so undoing means deleting
 * the row the assignment inserted, not reverting it to something. */
export type DisplacedMealSlot = { dayOfWeek: number; recipeId: string | null };

/** "Is any real meal plan already covering the CALENDAR WEEK containing
 * `weekStart`" -- shared by assignMealPlanDays's bootstrap-if-missing
 * below and domains/mealplan/approve-flow.ts#ensureMealPlanWeeksAhead's
 * per-week skip check, so this rule (a plan row with zero items doesn't
 * count as "existing," matching a partial/failed prior generation) only
 * lives in one place.
 *
 * Matches across the whole Sun-Sat window rather than on the exact date.
 * This is load-bearing, not defensive: plans written before 2026-08-15
 * are anchored to arbitrary weekdays (see weekStartFor), so an exact-date
 * check asking for "2026-08-19" could not see the perfectly good
 * 2026-08-16 plan covering the same week -- and generated a duplicate.
 * Normalizing new writes alone would not have fixed that, because the
 * legacy rows keep their old anchors. */
export async function mealPlanExistsForWeek(
  userId: string,
  weekStart: string,
  client?: SupabaseClient<Database>
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const week = getWeekDates(weekStart);

  const { data: plans, error } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "archived")
    .gte("week_start", week[0])
    .lte("week_start", week[6]);
  if (error) throw new Error(`Failed to check for an existing meal plan: ${error.message}`);
  if (!plans || plans.length === 0) return false;

  const { count, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select("id", { count: "exact", head: true })
    .in(
      "meal_plan_id",
      plans.map((p) => p.id)
    );
  if (itemsError) throw new Error(`Failed to check for existing meal plan items: ${itemsError.message}`);
  return (count ?? 0) > 0;
}

/**
 * Ensures a meal_plans row exists for the week WITHOUT generating any
 * meals into it. Callers that need somewhere to put an item use this;
 * a week full of food only ever comes from an explicit user request.
 *
 * Idempotent, and deliberately does not touch an existing row's status
 * or contents.
 */
export async function ensureEmptyMealPlanForWeek(
  userId: string,
  weekStart: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ planId: string }>> {
  const supabase = client ?? (await createClient());

  const { data: existing, error: readError } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, data: { planId: existing.id } };

  const { data: created, error: insertError } = await supabase
    .from("meal_plans")
    .insert({ user_id: userId, week_start: weekStart, status: "active" })
    .select("id")
    .single();
  if (insertError || !created) {
    return { ok: false, error: insertError?.message ?? "Failed to create a plan for that week." };
  }
  return { ok: true, data: { planId: created.id } };
}

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
 *
 * Returns the slots it displaced (`displaced`), so a caller offering
 * "undo this assignment" can put the week back exactly as it found it --
 * see restoreMealPlanDays. `recipeId: null` means that day had no item
 * at all before this call, so undoing it is a delete rather than a
 * revert. Captured here rather than re-read later because the previous
 * recipe is gone the moment the update lands.
 */
export async function assignMealPlanDays(
  userId: string,
  input: MealDayAssignmentInput,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[]; displaced: DisplacedMealSlot[] }>> {
  const supabase = client ?? (await createClient());
  const { weekStart, recipeId, mealType, daysOfWeek } = input;

  if (daysOfWeek.length === 0) {
    return { ok: false, error: "Pick at least one day to assign this to." };
  }
  if (daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, error: "Invalid day of week." };
  }

  // Create an EMPTY plan for the week if none exists -- do not generate
  // one (2026-08-16).
  //
  // This used to call generateAndSaveMealPlan, so adding a single Monday
  // breakfast silently populated all 21 slots of the week. That is the
  // behaviour behind the original complaint: a user who only cooks
  // Mon-Fri got Saturday and Sunday meals they never asked for, they
  // could not delete them (no delete path existed at all), and the
  // grocery list dutifully included the ingredients.
  //
  // An empty plan row is still required, since meal_plan_items are keyed
  // to it. status 'active' matches the previous auto-activate policy, so
  // the week shows up as calendar dots as soon as it has any content.
  let warnings: string[] = [];
  const planRow = await ensureEmptyMealPlanForWeek(userId, weekStart, supabase);
  if (!planRow.ok) return planRow;

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, meal_type, status, also_suitable_for")
    .eq("id", recipeId)
    .maybeSingle();
  if (recipeError) return { ok: false, error: recipeError.message };
  if (!recipe || recipe.status !== "active") {
    return { ok: false, error: "Recipe not found or no longer available." };
  }
  // Same union rule as swapMealPlanItem and the picker API.
  if (recipe.meal_type !== mealType && !(recipe.also_suitable_for ?? []).includes(mealType)) {
    return { ok: false, error: `This is a ${mealType} slot, and that recipe isn't suitable for it.` };
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
    .select("id, day_of_week, recipe_id")
    .eq("meal_plan_id", plan.id)
    .eq("meal_type", mealType)
    .in("day_of_week", daysOfWeek);
  if (itemsError) return { ok: false, error: itemsError.message };

  const existingByDay = new Map((existingItems ?? []).map((i) => [i.day_of_week, i]));
  const daysToUpdate = daysOfWeek.filter((d) => existingByDay.has(d));
  const daysToInsert = daysOfWeek.filter((d) => !existingByDay.has(d));

  // Snapshot before the writes below overwrite it.
  const displaced: DisplacedMealSlot[] = daysOfWeek.map((day) => ({
    dayOfWeek: day,
    recipeId: existingByDay.get(day)?.recipe_id ?? null,
  }));

  if (daysToUpdate.length > 0) {
    const itemIds = daysToUpdate.map((d) => existingByDay.get(d)!.id);
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

  return { ok: true, data: { warnings, displaced } };
}

/**
 * Undo half of assignMealPlanDays -- puts the given slots back to
 * whatever `displaced` said was there before, so "delete this change" or
 * "I meant Mon-Wed, not Sun-Tue" leaves the week exactly as the user
 * found it rather than punching a hole in it or re-rolling the
 * generator for a different recipe than the one they displaced.
 *
 * Deliberately writes no meal_pick_history: those rows are a preference
 * signal feeding future generation, and a pick the user then took back
 * is the opposite of a preference. The assign call already logged it;
 * we can't un-log cleanly, but we at least don't double-count a
 * reverted choice as two more signals.
 */
export async function restoreMealPlanDays(
  userId: string,
  input: { weekStart: string; mealType: MealType; slots: DisplacedMealSlot[] },
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const { weekStart, mealType, slots } = input;

  if (slots.length === 0) return { ok: true, data: { warnings: [] } };
  if (slots.some((s) => !Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6)) {
    return { ok: false, error: "Invalid day of week." };
  }

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  // Nothing to restore into -- the week was deleted out from under us
  // (e.g. a regeneration elsewhere). Not an error worth blocking on:
  // the state the caller wanted to undo is already gone.
  if (!plan) return { ok: true, data: { warnings: ["That week's plan no longer exists, so there was nothing to undo."] } };

  const daysToClear = slots.filter((s) => s.recipeId === null).map((s) => s.dayOfWeek);
  const slotsToRevert = slots.filter((s): s is { dayOfWeek: number; recipeId: string } => s.recipeId !== null);

  let warnings: string[] = [];

  if (daysToClear.length > 0) {
    const { error: deleteError } = await supabase
      .from("meal_plan_items")
      .delete()
      .eq("meal_plan_id", plan.id)
      .eq("user_id", userId)
      .eq("meal_type", mealType)
      .in("day_of_week", daysToClear);
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  // One update per distinct recipe rather than per slot -- an undo of
  // "this recipe on 5 days" collapses to a single statement.
  const daysByRecipe = new Map<string, number[]>();
  for (const slot of slotsToRevert) {
    daysByRecipe.set(slot.recipeId, [...(daysByRecipe.get(slot.recipeId) ?? []), slot.dayOfWeek]);
  }
  for (const [restoreRecipeId, days] of daysByRecipe) {
    const { error: updateError } = await supabase
      .from("meal_plan_items")
      .update({ recipe_id: restoreRecipeId })
      .eq("meal_plan_id", plan.id)
      .eq("user_id", userId)
      .eq("meal_type", mealType)
      .in("day_of_week", days);
    if (updateError) return { ok: false, error: updateError.message };
  }

  // Same downstream-refresh rule as assignMealPlanDays -- an undo
  // changes the week's contents just as much as the original edit did.
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

/**
 * Removes planned meals. Two shapes, one function, because they are the
 * same operation at different granularity:
 *   - `mealType` given -> clear that one slot on those days
 *   - `mealType` omitted -> clear the whole day
 *
 * This is the piece that did not exist before 2026-08-16. There was no
 * way, anywhere in the app or its API, to remove a planned meal -- which
 * is why "I only cook Mon-Fri" was unsatisfiable and the grocery list
 * could not be made to match how someone actually eats.
 *
 * The grocery list needs no special handling: it is derived from
 * meal_plan_items by getMealPlanForWeek, so deleting items is sufficient
 * and the regeneration below just materializes that.
 */
export async function clearMealPlanDays(
  userId: string,
  input: { weekStart: string; daysOfWeek: number[]; mealType?: MealType },
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[]; removed: number }>> {
  const supabase = client ?? (await createClient());
  const { weekStart, daysOfWeek, mealType } = input;

  if (daysOfWeek.length === 0) return { ok: false, error: "Pick at least one day to clear." };
  if (daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, error: "Invalid day of week." };
  }

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  // Nothing planned for that week is the desired end state already.
  if (!plan) return { ok: true, data: { warnings: [], removed: 0 } };

  let query = supabase
    .from("meal_plan_items")
    .delete()
    .eq("meal_plan_id", plan.id)
    .eq("user_id", userId)
    .in("day_of_week", daysOfWeek);
  if (mealType) query = query.eq("meal_type", mealType);

  const { data: deleted, error: deleteError } = await query.select("id");
  if (deleteError) return { ok: false, error: deleteError.message };

  let warnings: string[] = [];

  // Same downstream rule as assignMealPlanDays: only refresh what has
  // already been materialized. A not-yet-approved week picks these up
  // through the normal approve flow later.
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

  return { ok: true, data: { warnings, removed: (deleted ?? []).length } };
}
