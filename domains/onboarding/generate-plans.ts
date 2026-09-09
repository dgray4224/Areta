"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import {
  generateNutritionParameters,
  generateExerciseParameters,
  approveAllGeneratedParameters,
  getNutritionCalculationBaseInputs,
} from "@/domains/parameters/service";
import { calculateNutritionParameters } from "@/domains/parameters/nutrition-calc";
import { generateAndSaveWorkoutPlan, approveWorkoutPlan } from "@/domains/workoutplan/service";
import { ensureMealPlanWeeksAhead } from "@/domains/mealplan/approve-flow";
import type { ExerciseInput } from "@/domains/exercise/schema";

export type PlanReadiness = {
  nutrition: { ready: boolean; missingInputs: string[] };
  workout: { ready: boolean; missingInputs: string[] };
};

/**
 * What the post-onboarding "generate my plans?" popup shows BEFORE the
 * user commits: which of the two plans can actually be generated from
 * what they filled in, and what's missing if not. Mirrors the exact
 * missing-input checks the generators themselves enforce
 * (calculateNutritionParameters's missingInputs; the recommendation
 * engine's primaryGoal requirement) so the popup never promises a plan
 * the generator would then refuse.
 */
export async function getPlanReadiness(userId: string, client?: SupabaseClient<Database>): Promise<PlanReadiness> {
  const supabase = client ?? (await createClient());

  const [baseInputs, { data: responses }] = await Promise.all([
    getNutritionCalculationBaseInputs(userId, supabase),
    supabase.from("onboarding_responses").select("exercise").eq("user_id", userId).single(),
  ]);

  const { missingInputs: nutritionMissing } = calculateNutritionParameters(baseInputs);

  const exercise = (responses?.exercise ?? {}) as ExerciseInput;
  const workoutMissing: string[] = [];
  if (!exercise.primaryGoal) workoutMissing.push("your primary training goal");

  return {
    nutrition: { ready: nutritionMissing.length === 0, missingInputs: nutritionMissing },
    workout: { ready: workoutMissing.length === 0, missingInputs: workoutMissing },
  };
}

export type GeneratePlansResult = {
  nutrition: { ok: boolean; error?: string };
  workout: { ok: boolean; error?: string; warnings?: string[] };
  /** `skipped: true` when the user chose training only (meal planning off). */
  meals: { ok: boolean; skipped?: boolean; error?: string; weeks?: string[]; warnings?: string[] };
};

/**
 * One-tap plan setup for the post-onboarding popup: runs the full
 * generate-and-approve cascade for both plans so the user lands on a
 * ready account instead of walking /plan/setup's 4-generate + 4-approve
 * click path (parameters -> approve -> meal plan -> approve+cascade;
 * exercise parameters -> approve -> workout plan -> approve).
 *
 * CLAUDE.md rule 10's "require approval before a generated plan goes
 * live" is satisfied by the popup itself: the user explicitly tapped
 * "generate and load my plans" after being told what will happen — that
 * tap is the approval, the same way weekly regeneration's bundle
 * approval works (approveAllGeneratedParameters' original caller).
 * Everything remains editable/regenerable at /plan afterwards.
 *
 * The two chains are independent: a missing workout goal doesn't stop
 * the nutrition plan from generating, and vice versa — each reports its
 * own outcome for the popup to summarize honestly.
 */
export async function generatePlansAfterOnboarding(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<GeneratePlansResult> {
  const supabase = client ?? (await createClient());

  // --- Nutrition chain -------------------------------------------------
  let nutrition: GeneratePlansResult["nutrition"];
  let meals: GeneratePlansResult["meals"] = { ok: false, skipped: true };
  const nutritionParams = await generateNutritionParameters(userId, supabase);
  if (!nutritionParams.ok) {
    nutrition = { ok: false, error: nutritionParams.error };
  } else {
    const approve = await approveAllGeneratedParameters(userId, "nutrition", supabase);
    if (!approve.ok) {
      nutrition = { ok: false, error: approve.error };
    } else {
      nutrition = { ok: true };

      // The first week of meals IS the day-one product ("tap the meal we
      // planned"), so it is generated here, active immediately, with the
      // grocery list and prep plan cascaded -- the same path the Plan tab's
      // regenerate uses. Two preferences the week bends to (2026-09-09):
      // training-only users get no meal chain at all, and the shopping
      // horizon decides how many weeks are planned and consolidated. The
      // meal CRON stays off; weeks beyond the horizon are the user's call.
      const { data: prefs } = await supabase
        .from("profiles")
        .select("meal_planning_enabled, shopping_horizon_weeks")
        .eq("id", userId)
        .maybeSingle();
      if (prefs?.meal_planning_enabled === false) {
        meals = { ok: true, skipped: true };
      } else {
        const horizon = Math.min(4, Math.max(1, prefs?.shopping_horizon_weeks ?? 1));
        const generated = await ensureMealPlanWeeksAhead(userId, horizon, supabase);
        meals = generated.ok
          ? { ok: true, weeks: generated.data.generatedWeeks, warnings: generated.data.warnings }
          : { ok: false, error: generated.error };
      }
    }
  }

  // --- Workout chain ---------------------------------------------------
  let workout: GeneratePlansResult["workout"];
  const exerciseParams = await generateExerciseParameters(userId, supabase);
  if (!exerciseParams.ok) {
    workout = { ok: false, error: exerciseParams.error };
  } else {
    const approve = await approveAllGeneratedParameters(userId, "exercise", supabase);
    if (!approve.ok) {
      workout = { ok: false, error: approve.error };
    } else {
      const plan = await generateAndSaveWorkoutPlan(userId, undefined, supabase);
      if (!plan.ok) {
        workout = { ok: false, error: plan.error };
      } else {
        const activate = await approveWorkoutPlan(userId, supabase);
        workout = activate.ok ? { ok: true, warnings: plan.data.warnings } : { ok: false, error: activate.error };
      }
    }
  }

  return { nutrition, workout, meals };
}
