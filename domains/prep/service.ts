"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { getMealPlanForWeek } from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { generatePrepPlan, type PrepRecipeInfo } from "@/domains/prep/generate";
import { todayForUser } from "@/domains/activity-summary/service";

const OVEN_PATTERN = /oven|bake|roast|preheat/i;
const CARB_PATTERN = /rice|quinoa|pasta|potato|oats?|tortilla|bread|noodle/i;

/**
 * Operates on whichever meal plan was most recently made active, not a
 * hardcoded "this week" -- same fix and reasoning as
 * domains/grocery/service.ts#generateAndSaveGroceryList.
 */
export async function generateAndSavePrepPlan(userId: string, client?: SupabaseClient<Database>): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { data: activePlanRow } = await supabase
    .from("meal_plans")
    .select("week_start")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const weekStart = activePlanRow?.week_start ?? (await todayForUser(supabase, userId));
  const plan = await getMealPlanForWeek(userId, weekStart, supabase);
  if (!plan || plan.items.length === 0) {
    return { ok: false, error: "Generate and approve a meal plan first." };
  }

  const recipeIds = [...new Set(plan.items.map((i) => i.recipeId))];
  const recipes = await getRecipesByIds(recipeIds, supabase);

  const uniqueRecipes: PrepRecipeInfo[] = recipeIds
    .map((id) => recipes.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      name: r.name,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      servings: r.servings,
      needsOven: OVEN_PATTERN.test(r.instructions.join(" ")),
      hasProduceToWash: r.ingredients.some((i) => i.section === "produce"),
      hasProteinToCook: r.ingredients.some((i) => i.section === "protein"),
      hasCarbToCook: r.ingredients.some((i) => CARB_PATTERN.test(i.name)),
    }));

  const result = generatePrepPlan({ uniqueRecipes, totalMealCount: plan.items.length });

  const { data: prepPlan, error: planError } = await supabase
    .from("prep_plans")
    .upsert(
      {
        user_id: userId,
        meal_plan_id: plan.id,
        week_start: weekStart,
        estimated_minutes: result.estimatedMinutes,
        container_count: result.containerCount,
        status: "active",
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();

  if (planError || !prepPlan) {
    return { ok: false, error: `Failed to save prep plan: ${planError?.message}` };
  }

  const { error: deleteError } = await supabase
    .from("prep_steps")
    .delete()
    .eq("prep_plan_id", prepPlan.id);
  if (deleteError) {
    return { ok: false, error: `Failed to clear previous prep steps: ${deleteError.message}` };
  }

  const { error: insertError } = await supabase.from("prep_steps").insert(
    result.steps.map((step) => ({
      prep_plan_id: prepPlan.id,
      user_id: userId,
      step_number: step.stepNumber,
      instruction: step.instruction,
    }))
  );
  if (insertError) {
    return { ok: false, error: `Failed to save prep steps: ${insertError.message}` };
  }

  return { ok: true, data: undefined };
}

export type PrepPlanView = {
  id: string;
  weekStart: string;
  estimatedMinutes: number | null;
  containerCount: number | null;
  steps: { id: string; stepNumber: number; instruction: string }[];
};

export async function getPrepPlanForWeek(
  userId: string,
  weekStart?: string,
  client?: SupabaseClient<Database>
): Promise<PrepPlanView | null> {
  const supabase = client ?? (await createClient());
  const resolvedWeekStart = weekStart ?? (await todayForUser(supabase, userId));
  const { data: plan } = await supabase
    .from("prep_plans")
    .select("id, week_start, estimated_minutes, container_count")
    .eq("user_id", userId)
    .eq("week_start", resolvedWeekStart)
    .maybeSingle();

  if (!plan) return null;

  const { data: steps, error } = await supabase
    .from("prep_steps")
    .select("id, step_number, instruction")
    .eq("prep_plan_id", plan.id)
    .order("step_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load prep steps: ${error.message}`);
  }

  return {
    id: plan.id,
    weekStart: plan.week_start,
    estimatedMinutes: plan.estimated_minutes,
    containerCount: plan.container_count,
    steps: (steps ?? []).map((s) => ({
      id: s.id,
      stepNumber: s.step_number,
      instruction: s.instruction,
    })),
  };
}
