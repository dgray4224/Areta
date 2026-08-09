"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import { getAllRecipes, getRecipesByIds } from "@/domains/recipes/service";
import { generateMealPlan, type RecipeForPlanning } from "@/domains/mealplan/generate";
import type { NutritionInput } from "@/domains/nutrition/schema";
import type { RecipeCuisine } from "@/domains/recipes/types";
import { logScheduleEvent } from "@/platform/scheduling/log-schedule-event";
import { getWeekDates } from "@/platform/ui/week-dates";
import { todayForUser } from "@/domains/activity-summary/service";

function normalizeKeywords(list: string[] | undefined | null): string[] {
  if (!list) return [];
  return list.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Generates a fresh 7-day meal plan as a draft from the user's approved
 * nutrition parameters, preferences, and the shared recipe library. Does
 * not require re-approval of the plan's contents beyond the parameters it
 * was built from — but the plan itself still needs an explicit approve
 * step (see approveMealPlan) before it's "active" (CLAUDE.md rule 10).
 */
export async function generateAndSaveMealPlan(
  userId: string,
  options?: { weekStart?: string; extraExcludeKeywords?: string[]; preferredCuisines?: RecipeCuisine[] },
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());

  // A client with an active trainer-assigned nutrition program (2026-08-07,
  // mirrors domains/workoutplan/service.ts#generateAndSaveWorkoutPlan's own
  // guard) should never have it silently clobbered by the library
  // generator -- both upsert onto the same (user_id, week_start) row, so
  // whichever ran last would win with no warning either way. Trainer-side
  // generation always goes through
  // domains/trainermealprogram/materialize.ts#materializeCurrentMealWeek
  // instead, which is exempt from this check (different code path
  // entirely); this only guards the path a client could otherwise reach
  // by mistake (their own "Generate meal plan" button on /plan/meals).
  const { data: activeAssignment } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id")
    .eq("client_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (activeAssignment) {
    return {
      ok: false,
      error: "Your trainer has assigned you a nutrition program. Ask them to change or unassign it before generating a plan here.",
    };
  }

  const [calorieTarget, proteinTarget] = await Promise.all([
    getApprovedParameterValue(userId, "nutrition", "calorie_target", supabase),
    getApprovedParameterValue(userId, "nutrition", "protein_target_g", supabase),
  ]);

  if (calorieTarget === null || proteinTarget === null) {
    return { ok: false, error: "Approve your nutrition targets before generating a meal plan." };
  }

  const { data: responses } = await supabase
    .from("onboarding_responses")
    .select("nutrition")
    .eq("user_id", userId)
    .single();
  const nutrition = (responses?.nutrition ?? {}) as NutritionInput;

  const recipes = await getAllRecipes(supabase);
  const planningRecipes: RecipeForPlanning[] = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    mealType: r.mealType,
    cuisine: r.cuisine,
    calories: r.calories,
    proteinG: r.proteinG,
    searchableText: [r.name, ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase(),
  }));

  const excludeKeywords = [
    ...normalizeKeywords(nutrition.allergies),
    ...normalizeKeywords(nutrition.dislikedFoods),
    ...(options?.extraExcludeKeywords ?? []),
  ];

  const { days, warnings } = generateMealPlan({
    calorieTarget,
    proteinTarget,
    mealsPerDay: nutrition.mealsPerDay ?? 3,
    excludeKeywords,
    preferredCuisines: options?.preferredCuisines,
    recipes: planningRecipes,
  });

  const weekStart = options?.weekStart ?? (await todayForUser(supabase, userId));

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        status: "draft",
        calorie_target: calorieTarget,
        protein_target: proteinTarget,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();

  if (planError || !plan) {
    return { ok: false, error: `Failed to save meal plan: ${planError?.message}` };
  }

  const { error: deleteError } = await supabase
    .from("meal_plan_items")
    .delete()
    .eq("meal_plan_id", plan.id);
  if (deleteError) {
    return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };
  }

  const items = days.flatMap((day) =>
    day.meals.map((meal) => ({
      meal_plan_id: plan.id,
      user_id: userId,
      day_of_week: day.dayOfWeek,
      meal_type: meal.mealType,
      recipe_id: meal.recipeId,
      servings: 1,
    }))
  );

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("meal_plan_items").insert(items);
    if (itemsError) {
      return { ok: false, error: `Failed to save meal plan items: ${itemsError.message}` };
    }
  }

  return { ok: true, data: { warnings } };
}

/**
 * Approves whatever the most recent *draft* plan actually is, by id -- not
 * by an exact week_start === today match. Mirrors the same fix already
 * applied to domains/workoutplan/service.ts#approveWorkoutPlan (a draft's
 * week_start is stamped once, at generation time, so an exact-match
 * approve would silently match zero rows -- and thus silently do nothing
 * -- for anyone approving on a different day than generation, or for a
 * future week generated ahead of time via generateAndSaveMealPlanWeeks).
 */
export async function approveMealPlan(userId: string, client?: SupabaseClient<Database>): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { data: draftPlan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draftPlan) return { ok: false, error: "No draft plan to approve." };

  const { error } = await supabase.from("meal_plans").update({ status: "active" }).eq("id", draftPlan.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export type MealPlanItemView = {
  id: string;
  dayOfWeek: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId: string;
  servings: number;
  completedAt: string | null;
  nutritionLogId: string | null;
  scheduledTime: string | null;
  endTime: string | null;
  notes: string | null;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}:00`;
}

export type MealPlanView = {
  id: string;
  weekStart: string;
  status: "draft" | "active" | "archived";
  calorieTarget: number | null;
  proteinTarget: number | null;
  /** Which trainer_meal_programs row materialized this plan, if any
   * (domains/trainermealprogram/materialize.ts) -- null for a
   * self-generated plan. Lets a trainer's own nutrition page distinguish
   * "this is what I assigned" from "this is the client's own plan." */
  trainerMealProgramId: string | null;
  items: MealPlanItemView[];
};

export async function getMealPlanForWeek(
  userId: string,
  weekStart?: string,
  client?: SupabaseClient<Database>
): Promise<MealPlanView | null> {
  const supabase = client ?? (await createClient());
  const resolvedWeekStart = weekStart ?? (await todayForUser(supabase, userId));
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start, status, calorie_target, protein_target, trainer_meal_program_id")
    .eq("user_id", userId)
    .eq("week_start", resolvedWeekStart)
    .maybeSingle();

  if (!plan) return null;

  const { data: items, error } = await supabase
    .from("meal_plan_items")
    .select(
      "id, day_of_week, meal_type, recipe_id, servings, completed_at, nutrition_log_id, scheduled_time, end_time, notes"
    )
    .eq("meal_plan_id", plan.id)
    .order("day_of_week", { ascending: true });

  if (error) {
    throw new Error(`Failed to load meal plan items: ${error.message}`);
  }

  return {
    id: plan.id,
    weekStart: plan.week_start,
    status: plan.status as MealPlanView["status"],
    calorieTarget: plan.calorie_target,
    proteinTarget: plan.protein_target,
    trainerMealProgramId: plan.trainer_meal_program_id,
    items: (items ?? []).map((i) => ({
      id: i.id,
      dayOfWeek: i.day_of_week,
      mealType: i.meal_type as MealPlanItemView["mealType"],
      recipeId: i.recipe_id,
      servings: i.servings,
      completedAt: i.completed_at,
      nutritionLogId: i.nutrition_log_id,
      scheduledTime: i.scheduled_time,
      endTime: i.end_time,
      notes: i.notes,
    })),
  };
}

export async function getActiveMealPlan(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<MealPlanView | null> {
  const supabase = client ?? (await createClient());

  // Bounded to the Sun-Sat week containing today -- same fix as
  // domains/workoutplan/service.ts#getActiveWorkoutPlan (2026-08-07,
  // found investigating a real report on that side): an unbounded "most
  // recent active row by week_start" would silently surface a
  // far-future week's real content as "this week's plan" the moment
  // anything ever materializes several weeks of meal_plans ahead of
  // schedule for one user (no trainer-side "push weeks live" equivalent
  // exists for nutrition yet, so this can't actually happen in practice
  // today -- fixed anyway since /api/nutrition/route.ts already depends
  // on this function, and the same gap would silently reappear the
  // moment such a feature is added).
  const today = await todayForUser(supabase, userId);
  const weekDates = getWeekDates(today);
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start, status, calorie_target, protein_target")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("week_start", weekDates[0])
    .lte("week_start", weekDates[6])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;
  return getMealPlanForWeek(userId, plan.week_start, supabase);
}

/**
 * Resilient "what should this user see as their current meal plan"
 * lookup -- nutrition-side mirror of
 * domains/workoutplan/service.ts#getCurrentWorkoutPlan (see that
 * function's own doc comment for the full "why exact-match alone misses
 * a plan generated on a different day this week" reasoning). Added
 * 2026-08-07 alongside the getActiveMealPlan week-bounding fix, to close
 * the last piece of the "meal plans have the same stale-lookup bug
 * workouts just got fixed for" gap this file's own README entry already
 * flagged: domains/trainer/service.ts#getClientNutritionOverview was
 * still calling plain getMealPlanForWeek(clientId, undefined) directly,
 * which only ever matches the exact literal day materialization last ran
 * -- any other day, a real active plan would show as "no meal plan" even
 * though one exists. `/plan/meals` (the self-service page) has its own
 * separate, still-open instance of this same gap -- not fixed here,
 * still tracked in the README.
 */
export async function getCurrentMealPlan(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<MealPlanView | null> {
  const supabase = client ?? (await createClient());
  const todaysPlan = await getMealPlanForWeek(userId, undefined, supabase);
  if (todaysPlan) return todaysPlan;
  return getActiveMealPlan(userId, supabase);
}

/**
 * Marks a planned meal eaten/not-eaten (mobile Nutrition tab). Unlike
 * workout-plan completion, there's no auto-sync data source for food, so
 * completing also writes a real nutrition_logs row derived from the
 * recipe's known macros (scaled by servings) -- the checkbox both marks
 * completion and captures real nutrition data without the user re-typing
 * it. This is the "stuck to the plan" path; a user who ate something
 * different instead uses the existing freeform logNutrition. Un-completing
 * deletes the auto-generated log row, which only ever represented this
 * checkbox's own state.
 */
export async function setMealPlanItemCompleted(
  userId: string,
  itemId: string,
  completed: boolean,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  if (!completed) {
    const { data: item } = await supabase
      .from("meal_plan_items")
      .select("nutrition_log_id")
      .eq("id", itemId)
      .eq("user_id", userId)
      .maybeSingle();

    if (item?.nutrition_log_id) {
      await supabase.from("nutrition_logs").delete().eq("id", item.nutrition_log_id);
    }

    const { error } = await supabase
      .from("meal_plan_items")
      .update({ completed_at: null, nutrition_log_id: null })
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, data: undefined };
  }

  const { data: item, error: itemError } = await supabase
    .from("meal_plan_items")
    .select("id, meal_type, recipe_id, servings")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (itemError || !item) {
    return { ok: false, error: itemError?.message ?? "Meal plan item not found" };
  }

  const recipes = await getRecipesByIds([item.recipe_id], supabase);
  const recipe = recipes.get(item.recipe_id);
  if (!recipe) {
    return { ok: false, error: "Recipe not found for this meal plan item" };
  }

  const today = await todayForUser(supabase, userId);
  const { data: log, error: logError } = await supabase
    .from("nutrition_logs")
    .insert({
      user_id: userId,
      date: today,
      meal: item.meal_type,
      food: recipe.name,
      quantity: item.servings,
      unit: "serving",
      calories: recipe.calories * item.servings,
      protein: recipe.proteinG * item.servings,
      carbohydrates: recipe.carbsG * item.servings,
      fat: recipe.fatG * item.servings,
      fiber: recipe.fiberG !== null ? recipe.fiberG * item.servings : null,
    })
    .select("id")
    .single();

  if (logError || !log) {
    return { ok: false, error: logError?.message ?? "Failed to create nutrition log" };
  }

  const { error: updateError } = await supabase
    .from("meal_plan_items")
    .update({ completed_at: new Date().toISOString(), nutrition_log_id: log.id })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  return { ok: true, data: undefined };
}

/**
 * Sets (or clears, if null) the user's dragged/chosen clock time for a
 * planned meal (mobile Nutrition/At-a-Glance timeline). A separate
 * function from setMealPlanItemCompleted -- different trigger
 * (drag-release vs. a tap) and zero shared logic (this one never touches
 * nutrition_logs).
 *
 * Two modes for end_time, mirroring domains/timeline/service.ts's
 * setTimelineEventScheduledTime:
 * - endTime === undefined (drag, or any single-time reschedule): shifts
 *   end_time by the same delta as the start, preserving whatever
 *   duration was already established.
 * - endTime provided explicitly (the edit sheet's start+end pickers):
 *   both are set exactly as given, no shift logic.
 * Unscheduling (scheduledTime = null) clears end_time too either way.
 */
export async function setMealPlanItemScheduledTime(
  userId: string,
  itemId: string,
  scheduledTime: string | null,
  client?: SupabaseClient<Database>,
  endTime?: string | null
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  let resolvedEndTime: string | null = null;
  if (scheduledTime) {
    if (endTime !== undefined) {
      resolvedEndTime = endTime;
    } else {
      const { data: existing } = await supabase
        .from("meal_plan_items")
        .select("scheduled_time, end_time")
        .eq("id", itemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing?.scheduled_time && existing?.end_time) {
        const durationMinutes = timeToMinutes(existing.end_time) - timeToMinutes(existing.scheduled_time);
        resolvedEndTime = minutesToTime(timeToMinutes(scheduledTime) + durationMinutes);
      }
    }
  }

  const { data, error } = await supabase
    .from("meal_plan_items")
    .update({ scheduled_time: scheduledTime, end_time: scheduledTime ? resolvedEndTime : null })
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("meal_type")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (scheduledTime && data) {
    await logScheduleEvent(userId, "meal", data.meal_type, itemId, scheduledTime, supabase, "planned");
  }
  return { ok: true, data: undefined };
}

/** Free-text note on a single planned meal (mobile timeline detail view). */
export async function setMealPlanItemNotes(
  userId: string,
  itemId: string,
  notes: string | null,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("meal_plan_items")
    .update({ notes })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/**
 * Swaps a planned meal's recipe (mobile Plan tab "change what I want to
 * prep to eat," Phase F/B of the Plan-tab-overhaul plan). Deliberately
 * lighter validation than swapWorkoutPlanItemExercise's sibling-slot
 * check -- there's no curated "alternates" concept for meals, any active
 * recipe is a valid choice for its meal type, so the only two guards that
 * matter are: the replacement must actually be a real, currently-active
 * recipe (not draft/deprecated -- same status gate getAllRecipes applies
 * to plan generation, so a swap can never point a plan at something
 * generation itself would never have offered), and it must match the
 * slot's mealType (a "breakfast" slot swapped to a "dinner" recipe would
 * silently corrupt the day's calorie/protein totals and grocery
 * grouping). Servings carries over unchanged from the existing item.
 */
export async function swapMealPlanItem(
  userId: string,
  itemId: string,
  recipeId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<MealPlanItemView>> {
  const supabase = client ?? (await createClient());

  const { data: item, error: itemError } = await supabase
    .from("meal_plan_items")
    .select("id, day_of_week, meal_type, servings, completed_at, nutrition_log_id, scheduled_time, end_time, notes")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (itemError) return { ok: false, error: itemError.message };
  if (!item) return { ok: false, error: "Planned meal not found." };

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, meal_type, status")
    .eq("id", recipeId)
    .maybeSingle();

  if (recipeError) return { ok: false, error: recipeError.message };
  if (!recipe || recipe.status !== "active") {
    return { ok: false, error: "Recipe not found or no longer available." };
  }
  if (recipe.meal_type !== item.meal_type) {
    return { ok: false, error: `This slot needs a ${item.meal_type} recipe, not ${recipe.meal_type}.` };
  }

  const { error: updateError } = await supabase
    .from("meal_plan_items")
    .update({ recipe_id: recipeId })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (updateError) return { ok: false, error: updateError.message };

  return {
    ok: true,
    data: {
      id: item.id,
      dayOfWeek: item.day_of_week,
      mealType: item.meal_type as MealPlanItemView["mealType"],
      recipeId,
      servings: item.servings,
      completedAt: item.completed_at,
      nutritionLogId: item.nutrition_log_id,
      scheduledTime: item.scheduled_time,
      endTime: item.end_time,
      notes: item.notes,
    },
  };
}
