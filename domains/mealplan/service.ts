"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { getApprovedNutritionValue } from "@/domains/parameters/service";
import { getAllRecipes } from "@/domains/recipes/service";
import { generateMealPlan, type RecipeForPlanning } from "@/domains/mealplan/generate";
import type { NutritionInput } from "@/domains/nutrition/schema";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitKeywords(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
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
  options?: { extraExcludeKeywords?: string[] }
): Promise<ActionResult<{ warnings: string[] }>> {
  const [calorieTarget, proteinTarget] = await Promise.all([
    getApprovedNutritionValue(userId, "calorie_target"),
    getApprovedNutritionValue(userId, "protein_target_g"),
  ]);

  if (calorieTarget === null || proteinTarget === null) {
    return { ok: false, error: "Approve your nutrition targets before generating a meal plan." };
  }

  const supabase = await createClient();
  const { data: responses } = await supabase
    .from("onboarding_responses")
    .select("nutrition")
    .eq("user_id", userId)
    .single();
  const nutrition = (responses?.nutrition ?? {}) as NutritionInput;

  const recipes = await getAllRecipes();
  const planningRecipes: RecipeForPlanning[] = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    mealType: r.mealType,
    calories: r.calories,
    proteinG: r.proteinG,
    searchableText: [r.name, ...r.ingredients.map((i) => i.name)].join(" ").toLowerCase(),
  }));

  const excludeKeywords = [
    ...splitKeywords(nutrition.allergies),
    ...splitKeywords(nutrition.dislikedFoods),
    ...(options?.extraExcludeKeywords ?? []),
  ];

  const { days, warnings } = generateMealPlan({
    calorieTarget,
    proteinTarget,
    mealsPerDay: nutrition.mealsPerDay ?? 3,
    excludeKeywords,
    recipes: planningRecipes,
  });

  const weekStart = currentWeekStart();

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

export async function approveMealPlan(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const weekStart = currentWeekStart();
  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "active" })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

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
};

export type MealPlanView = {
  id: string;
  weekStart: string;
  status: "draft" | "active" | "archived";
  calorieTarget: number | null;
  proteinTarget: number | null;
  items: MealPlanItemView[];
};

export async function getMealPlanForWeek(
  userId: string,
  weekStart = currentWeekStart()
): Promise<MealPlanView | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start, status, calorie_target, protein_target")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan) return null;

  const { data: items, error } = await supabase
    .from("meal_plan_items")
    .select("id, day_of_week, meal_type, recipe_id, servings")
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
    items: (items ?? []).map((i) => ({
      id: i.id,
      dayOfWeek: i.day_of_week,
      mealType: i.meal_type as MealPlanItemView["mealType"],
      recipeId: i.recipe_id,
      servings: i.servings,
    })),
  };
}

export async function getActiveMealPlan(userId: string): Promise<MealPlanView | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start, status, calorie_target, protein_target")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;
  return getMealPlanForWeek(userId, plan.week_start);
}
