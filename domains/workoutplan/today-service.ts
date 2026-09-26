"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExerciseInput } from "@/domains/exercise/schema";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { EXPERIENCE_TO_TIER, type LimitationRule } from "@/domains/recommendation/types";
import {
  generateTodayWorkouts,
  type GenerateTodayResult,
  type TodayFocus,
} from "@/domains/workoutplan/generate-today";
import type { ActionResult } from "@/platform/auth/actions";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";

/**
 * I/O for the on-demand "generate a workout today" flow. The choosing
 * itself is pure and lives in generate-today.ts; this only loads what
 * that function needs.
 *
 * Deliberately the same inputs the weekly engine uses -- the library,
 * the user's approved limitation rules, their onboarding answers, and
 * what they have actually been doing for the last three weeks. A
 * workout generated on demand is held to the same standard as one the
 * Sunday plan produces; the only difference is who asked for it.
 */

const RECENT_USE_WINDOW_DAYS = 21;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getTodayWorkoutOptions(
  userId: string,
  focus: TodayFocus,
  client?: SupabaseClient<Database>
): Promise<ActionResult<GenerateTodayResult>> {
  const supabase = client ?? (await createClient());

  const [{ data: onboardingRow }, { data: ruleRows }, exercises, { data: recentItems }] = await Promise.all([
    supabase.from("onboarding_responses").select("exercise").eq("user_id", userId).maybeSingle(),
    supabase
      .from("limitation_rules")
      .select("limitation_tag, action, movement_pattern, substitute_movement_pattern, rationale")
      .eq("status", "approved"),
    getAllExercises(client),
    supabase
      .from("workout_plan_items")
      .select("exercise_id, workout_plans!inner(user_id, week_start)")
      .eq("workout_plans.user_id", userId)
      .gte("workout_plans.week_start", isoDaysAgo(RECENT_USE_WINDOW_DAYS)),
  ]);

  const exerciseInput = (onboardingRow?.exercise as ExerciseInput | null) ?? {};

  const limitationRules: LimitationRule[] = (ruleRows ?? []).map((r) => ({
    limitationTag: r.limitation_tag,
    action: r.action as LimitationRule["action"],
    movementPattern: r.movement_pattern,
    substituteMovementPattern: r.substitute_movement_pattern,
    rationale: r.rationale,
  }));

  const recentUseCounts = new Map<string, number>();
  for (const item of recentItems ?? []) {
    recentUseCounts.set(item.exercise_id, (recentUseCounts.get(item.exercise_id) ?? 0) + 1);
  }

  // Missing answer => beginner, the same conservative default
  // exercise-calc.ts and the template engine both take. It only ever
  // narrows what can be recommended.
  const tier = exerciseInput.recentExperience
    ? EXPERIENCE_TO_TIER[exerciseInput.recentExperience]
    : "beginner";

  return {
    ok: true,
    data: generateTodayWorkouts({
      userId,
      focus,
      tier,
      exercises,
      exercise: exerciseInput,
      limitationRules,
      recentUseCounts,
    }),
  };
}
