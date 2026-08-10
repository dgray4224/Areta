import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import { getMealPlanForWeek, type MealPlanView } from "@/domains/mealplan/service";
import { getWorkoutPlanForWeek, type WorkoutPlanView, type WorkoutPlanProgramContext } from "@/domains/workoutplan/service";
import { classifyWeeklyTrainingFocus, type WeeklyTrainingFocus } from "@/domains/workoutplan/training-focus";
import { getRecipesByIds } from "@/domains/recipes/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { getWeekDates } from "@/platform/ui/week-dates";
import { todayForUser } from "@/domains/activity-summary/service";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolveWeekStart(
  table: "meal_plans" | "workout_plans",
  userId: string,
  weekDates: string[],
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  // Only ever surfaces an approved ("active") plan -- same as
  // getActiveMealPlan/getActiveWorkoutPlan. A "draft" row mid-generation
  // (this repo's generate/approve gate) has no business appearing on the
  // Plan tab/page, which has no approve affordance of its own to resolve it.
  const { data: plan } = await supabase
    .from(table)
    .select("week_start")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("week_start", weekDates[0])
    .lte("week_start", weekDates[6])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return plan?.week_start ?? null;
}

type WeekResolution = { weekAnchor: string; mealPlan: MealPlanView | null; workoutPlan: WorkoutPlanView | null };

async function resolveWeek(userId: string, weekAnchor: string, supabase: SupabaseClient<Database>): Promise<WeekResolution> {
  const weekDates = getWeekDates(weekAnchor);
  const [mealWeekStart, workoutWeekStart] = await Promise.all([
    resolveWeekStart("meal_plans", userId, weekDates, supabase),
    resolveWeekStart("workout_plans", userId, weekDates, supabase),
  ]);
  const [mealPlan, workoutPlan] = await Promise.all([
    mealWeekStart ? getMealPlanForWeek(userId, mealWeekStart, supabase) : null,
    workoutWeekStart ? getWorkoutPlanForWeek(userId, workoutWeekStart, supabase) : null,
  ]);
  return { weekAnchor, mealPlan, workoutPlan };
}

export type PlanRangeDay = {
  date: string;
  meals: {
    id: string;
    mealType: string;
    recipeName: string;
    cuisine: string | null;
    allergens: string[];
    photoUrl: string | null;
    completed: boolean;
  }[];
  workouts: { id: string; exerciseName: string; completed: boolean }[];
};

export type PlanRange = {
  rangeStart: string;
  rangeEnd: string;
  hasMealPlan: boolean;
  hasWorkoutPlan: boolean;
  phaseFocus: string | null;
  programContext: WorkoutPlanProgramContext | null;
  weekTrainingFocus: WeeklyTrainingFocus | null;
  thisWeekMealPlanUpdatedAt: string | null;
  thisWeekWorkoutPlanUpdatedAt: string | null;
  days: PlanRangeDay[];
};

/**
 * "Meal/workout item names per date" across an arbitrary inclusive date
 * range, possibly spanning several Sun-Sat weeks (a month-grid calendar
 * needs 5-6 weeks; a plain week view needs 1) -- each week is its own
 * meal_plans/workout_plans row, so this resolves and merges one week at a
 * time via getMealPlanForWeek/getWorkoutPlanForWeek rather than a single
 * cross-week query.
 *
 * Shared by the mobile bearer route (app/api/plan/route.ts, which now
 * just calls this) and web's own Plan calendar page, so the two compute
 * the exact same "what's planned on this date" answer -- same extraction
 * pattern as getReviewSummaryBundle/getVitalsTrend/getExerciseHistory.
 */
export async function getPlanRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  client?: SupabaseClient<Database>
): Promise<PlanRange> {
  const supabase = client ?? (await createClient());
  const today = await todayForUser(supabase, userId);

  // Every Sunday-aligned week that overlaps [rangeStart, rangeEnd].
  const weekAnchors: string[] = [];
  for (let cursor = getWeekDates(rangeStart)[0]; cursor <= rangeEnd; cursor = addDays(cursor, 7)) {
    weekAnchors.push(cursor);
  }

  const resolutions = await Promise.all(weekAnchors.map((anchor) => resolveWeek(userId, anchor, supabase)));

  const allRecipeIds = new Set<string>();
  const allExerciseIds = new Set<string>();
  for (const { mealPlan, workoutPlan } of resolutions) {
    for (const i of mealPlan?.items ?? []) allRecipeIds.add(i.recipeId);
    for (const i of workoutPlan?.items ?? []) allExerciseIds.add(i.exerciseId);
  }
  const [recipes, exercises] = await Promise.all([
    getRecipesByIds([...allRecipeIds], supabase),
    getExercisesByIds([...allExerciseIds], supabase),
  ]);

  const byDate = new Map<string, { meals: PlanRangeDay["meals"]; workouts: PlanRangeDay["workouts"] }>();
  for (const { weekAnchor, mealPlan, workoutPlan } of resolutions) {
    const weekDates = getWeekDates(weekAnchor);
    for (const i of mealPlan?.items ?? []) {
      const date = weekDates[i.dayOfWeek];
      if (!byDate.has(date)) byDate.set(date, { meals: [], workouts: [] });
      const recipe = recipes.get(i.recipeId);
      byDate.get(date)!.meals.push({
        id: i.id,
        mealType: i.mealType,
        recipeName: recipe?.name ?? "Unknown recipe",
        cuisine: recipe?.cuisine ?? null,
        allergens: recipe?.allergens ?? [],
        photoUrl: recipe?.photoUrl ?? null,
        completed: i.completedAt !== null,
      });
    }
    for (const i of workoutPlan?.items ?? []) {
      const date = weekDates[i.dayOfWeek];
      if (!byDate.has(date)) byDate.set(date, { meals: [], workouts: [] });
      byDate.get(date)!.workouts.push({
        id: i.id,
        exerciseName: exercises.get(i.exerciseId)?.name ?? "Unknown exercise",
        completed: i.completedAt !== null,
      });
    }
  }

  const days: PlanRangeDay[] = [];
  for (let date = rangeStart; date <= rangeEnd; date = addDays(date, 1)) {
    const entry = byDate.get(date);
    days.push({ date, meals: entry?.meals ?? [], workouts: entry?.workouts ?? [] });
  }

  const hasMealPlan = resolutions.some((r) => r.mealPlan !== null);
  const hasWorkoutPlan = resolutions.some((r) => r.workoutPlan !== null);
  const firstWorkoutPlan = resolutions.find((r) => r.workoutPlan !== null)?.workoutPlan ?? null;

  const todaysWeekAnchor = getWeekDates(today)[0];
  const thisWeekResolution = resolutions.find((r) => r.weekAnchor === todaysWeekAnchor) ?? null;
  const thisWeekWorkoutPlan = thisWeekResolution?.workoutPlan ?? null;
  const weekTrainingFocus = thisWeekWorkoutPlan
    ? classifyWeeklyTrainingFocus(thisWeekWorkoutPlan.items, exercises)
    : null;

  return {
    rangeStart,
    rangeEnd,
    hasMealPlan,
    hasWorkoutPlan,
    phaseFocus: firstWorkoutPlan?.phaseFocus ?? null,
    programContext: firstWorkoutPlan?.programContext ?? null,
    weekTrainingFocus,
    thisWeekMealPlanUpdatedAt: thisWeekResolution?.mealPlan?.updatedAt ?? null,
    thisWeekWorkoutPlanUpdatedAt: thisWeekWorkoutPlan?.updatedAt ?? null,
    days,
  };
}
