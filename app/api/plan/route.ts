import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getMealPlanForWeek, type MealPlanView } from "@/domains/mealplan/service";
import { getWorkoutPlanForWeek, type WorkoutPlanView } from "@/domains/workoutplan/service";
import { classifyWeeklyTrainingFocus } from "@/domains/workoutplan/training-focus";
import { getRecipesByIds } from "@/domains/recipes/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { getWeekDates } from "@/platform/ui/week-dates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

/**
 * Bearer-token-authenticated read endpoint for the mobile Plan tab.
 * Powers both the week-outlook view (`?week=`) and the month calendar
 * grid (`?start=&end=`, an arbitrary inclusive date range spanning
 * possibly several weeks) -- both just want "meal/workout item names per
 * date," condensed from getMealPlanForWeek/getWorkoutPlanForWeek the same
 * way app/(app)/plan/page.tsx's WeekView already renders on web. Editing
 * an individual day's items still goes through /api/nutrition and
 * /api/exercise (the latter generalized to accept ?date= alongside this
 * route so edits aren't locked to today -- see that route's own comment).
 *
 * A range can span multiple Sun-Sat weeks (each backed by its own
 * meal_plans/workout_plans row), so this resolves and merges one week at
 * a time -- getMealPlanForWeek/getWorkoutPlanForWeek are exact-week
 * lookups, there's no single query across week boundaries.
 */

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  // Plan tab, which has no approve affordance of its own to resolve it.
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

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const params = request.nextUrl.searchParams;
  const explicitStart = params.get("start");
  const explicitEnd = params.get("end");
  const weekAnchorParam = params.get("week");

  const rangeStart = explicitStart ?? getWeekDates(weekAnchorParam ?? todayDateString())[0];
  const rangeEnd = explicitEnd ?? getWeekDates(weekAnchorParam ?? todayDateString())[6];

  // Every Sunday-aligned week that overlaps [rangeStart, rangeEnd] --
  // e.g. a month grid's 5-6 weeks, or just one for the plain week view.
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

  const byDate = new Map<
    string,
    {
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
    }
  >();
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

  const days = [];
  for (let date = rangeStart; date <= rangeEnd; date = addDays(date, 1)) {
    const entry = byDate.get(date);
    days.push({ date, meals: entry?.meals ?? [], workouts: entry?.workouts ?? [] });
  }

  const hasMealPlan = resolutions.some((r) => r.mealPlan !== null);
  const hasWorkoutPlan = resolutions.some((r) => r.workoutPlan !== null);
  // Phase/program context is a single-plan concept -- a multi-week range
  // (the month grid) may span more than one, so this just surfaces
  // whichever resolved week's workout plan comes first chronologically.
  // Good enough for a header hint; not meant to be exhaustive per-week.
  const firstWorkoutPlan = resolutions.find((r) => r.workoutPlan !== null)?.workoutPlan ?? null;

  // Training-focus classification is specific to "this week" (the
  // Calendar summary card), not the whole possibly-multi-week range --
  // only computed when that week's resolution actually landed in this
  // request (it always will for the plain week view; a month-grid
  // request only includes it if today falls inside the requested range).
  const todaysWeekAnchor = getWeekDates(todayDateString())[0];
  const thisWeekWorkoutPlan = resolutions.find((r) => r.weekAnchor === todaysWeekAnchor)?.workoutPlan ?? null;
  const weekTrainingFocus = thisWeekWorkoutPlan
    ? classifyWeeklyTrainingFocus(thisWeekWorkoutPlan.items, exercises)
    : null;

  return NextResponse.json({
    rangeStart,
    rangeEnd,
    hasMealPlan,
    hasWorkoutPlan,
    phaseFocus: firstWorkoutPlan?.phaseFocus ?? null,
    programContext: firstWorkoutPlan?.programContext ?? null,
    weekTrainingFocus,
    days,
  });
}
