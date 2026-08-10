import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getDashboardTrends } from "../../trends-data";
import { getRecentExerciseLogs } from "@/domains/exercise/service";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import { WeightTrendChart } from "@/platform/ui/charts/WeightTrendChart";
import { SleepTrendChart } from "@/platform/ui/charts/SleepTrendChart";
import { NutritionAdherenceChart } from "@/platform/ui/charts/NutritionAdherenceChart";
import { getActiveMealPlan } from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { getExercisesByIds, getAllExercises } from "@/domains/exerciselibrary/service";
import { getNutritionLogsForDate } from "@/domains/nutrition/log-service";
import { todayForUser } from "@/domains/activity-summary/service";
import { NutritionToday, type PlannedMealView, type LoggedFoodView } from "./NutritionToday";
import { ExerciseToday, type PlannedExerciseView, type SyncedWorkoutView } from "./ExerciseToday";
import { getActiveWorkoutPlan } from "@/domains/workoutplan/service";
import { getRecentWorkoutLogs } from "@/domains/workout/service";
import { getExerciseHistory } from "@/domains/workout/history";
import { VitalsMiniChart } from "@/platform/ui/charts/VitalsMiniChart";

const RECENT_FOODS_LOOKBACK_DAYS = 6;

function shiftDateString(dateString: string, deltaDays: number): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekFor(dateString: string): number {
  return new Date(`${dateString}T00:00:00Z`).getUTCDay();
}

export default async function DashboardDomainDetailPage({
  params,
}: {
  params: Promise<{ section: string; domain: string }>;
}) {
  const { domain } = await params;
  const user = await requireUser();

  if (domain === "nutrition") {
    const supabase = await createClient();
    const today = await todayForUser(supabase, user.id);
    const dow = dayOfWeekFor(today);

    const [trends, mealPlan, todaysLogs, recentDaysLogs] = await Promise.all([
      getDashboardTrends(user.id),
      getActiveMealPlan(user.id, supabase, today),
      getNutritionLogsForDate(user.id, today, supabase),
      Promise.all(
        Array.from({ length: RECENT_FOODS_LOOKBACK_DAYS }, (_, i) =>
          getNutritionLogsForDate(user.id, shiftDateString(today, -(i + 1)), supabase).catch(() => [])
        )
      ),
    ]);

    const todaysItems = mealPlan?.items.filter((item) => item.dayOfWeek === dow) ?? [];
    const recipeMap = await getRecipesByIds(
      todaysItems.map((item) => item.recipeId),
      supabase
    );
    const plannedMeals: PlannedMealView[] = todaysItems.map((item) => {
      const recipe = recipeMap.get(item.recipeId);
      return {
        id: item.id,
        recipeName: recipe?.name ?? "Unknown recipe",
        cuisine: recipe?.cuisine ?? null,
        photoUrl: recipe?.photoUrl ?? null,
        mealType: item.mealType,
        servings: item.servings,
        completedAt: item.completedAt,
        notes: item.notes,
      };
    });
    const recentFoodNames = recentDaysLogs.flat().map((l) => l.food);
    // meal is a plain `text` column server-side, not a DB enum — narrow it
    // here rather than widening LoggedFoodView's type, since every writer
    // of nutrition_logs (this page's own form, mobile, the meal-plan
    // completion path) only ever writes one of the four real values.
    const todaysLogsView: LoggedFoodView[] = todaysLogs.map((l) => ({
      ...l,
      meal: l.meal as LoggedFoodView["meal"],
    }));

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Nutrition</h1>

        <NutritionToday
          userId={user.id}
          date={today}
          initialPlan={plannedMeals}
          initialLogs={todaysLogsView}
          recentFoodNames={recentFoodNames}
        />

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-1 text-sm font-medium">Calorie adherence · last 30 days</p>
          <NutritionAdherenceChart data={trends.nutrition.data} target={trends.nutrition.target} />
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-1 text-sm font-medium">Weight · last 30 days</p>
          <WeightTrendChart data={trends.weight.data} unit={trends.weight.unit} />
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/plan/parameters" className="underline">
            Nutrition targets
          </Link>
          <Link href="/plan/meals" className="underline">
            Meal plan
          </Link>
        </div>
      </div>
    );
  }

  if (domain === "sleep") {
    const trends = await getDashboardTrends(user.id);
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Sleep</h1>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-1 text-sm font-medium">Sleep duration · last 30 days</p>
          <SleepTrendChart data={trends.sleep} />
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/log/sleep" className="underline">
            Log sleep
          </Link>
        </div>
      </div>
    );
  }

  if (domain === "exercise") {
    const supabase = await createClient();
    const today = await todayForUser(supabase, user.id);
    const dow = dayOfWeekFor(today);

    const [sessionsPerWeek, recentLogs, workoutPlan, todaysWorkoutLogsRaw, history, exerciseLibrary] = await Promise.all([
      getApprovedParameterValue(user.id, "exercise", "sessions_per_week"),
      getRecentExerciseLogs(user.id, 14),
      getActiveWorkoutPlan(user.id, supabase, today),
      getRecentWorkoutLogs(user.id, 1, supabase),
      getExerciseHistory(user.id, 7, supabase),
      getAllExercises(supabase),
    ]);

    const todaysItems = workoutPlan?.items.filter((item) => item.dayOfWeek === dow) ?? [];
    const exerciseMap = await getExercisesByIds(
      todaysItems.map((item) => item.exerciseId),
      supabase
    );
    const plannedExercises: PlannedExerciseView[] = todaysItems.map((item) => ({
      id: item.id,
      exerciseName: exerciseMap.get(item.exerciseId)?.name ?? "Unknown exercise",
      completedAt: item.completedAt,
      notes: item.notes,
      substituted: item.substituted,
      sets: item.sets,
      reps: item.reps,
      repsMin: item.repsMin,
      repsMax: item.repsMax,
      durationMinutes: item.durationMinutes,
      intensityType: item.intensityType,
      intensityValue: item.intensityValue,
      cardioIntensity: item.cardioIntensity,
    }));
    // getRecentWorkoutLogs(days: 1) is a rolling 24h window, not "today" by
    // calendar day — filter to the user's actual local today the same way
    // getExerciseHistory buckets its own days, so this list and that chart
    // never disagree about what counts as "today."
    const syncedWorkouts: SyncedWorkoutView[] = todaysWorkoutLogsRaw
      .filter((log) => log.start_date.slice(0, 10) === today)
      .map((log) => ({
        id: log.id,
        activityType: log.activity_type,
        durationMinutes: log.duration_minutes,
        caloriesBurned: log.total_energy_burned_kcal,
      }));

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Exercise</h1>

        <ExerciseToday
          userId={user.id}
          dayOfWeek={dow}
          plan={plannedExercises}
          exercises={exerciseLibrary}
          syncedWorkouts={syncedWorkouts}
        />

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-500">Target sessions per week</p>
          <p className="text-lg font-medium">{sessionsPerWeek ?? "Not set yet"}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-2 text-sm font-medium">Last 7 days</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-500">Exercise minutes</p>
              <VitalsMiniChart
                data={history.map((d) => ({ date: d.date, value: d.exerciseMinutes }))}
                unit="min"
                seriesKey="series1"
              />
            </div>
            <div>
              <p className="text-xs text-neutral-500">Calories burned</p>
              <VitalsMiniChart
                data={history.map((d) => ({ date: d.date, value: d.caloriesBurned }))}
                unit="kcal"
                seriesKey="series2"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-500">Recent logged sessions</p>
          {recentLogs.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex justify-between gap-4">
                  <span className="text-neutral-500">{log.date}</span>
                  <span>
                    {log.archetype ?? "Session"}
                    {log.duration_minutes ? ` · ${log.duration_minutes} min` : ""}
                    {log.perceived_exertion ? ` · RPE ${log.perceived_exertion}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No sessions logged yet" />
          )}
        </div>

        <div className="flex gap-4 text-sm">
          <Link href="/plan/exercise-parameters" className="underline">
            Training parameters
          </Link>
          <Link href="/plan/workouts" className="underline">
            Workout plan
          </Link>
          <Link href="/log/exercise" className="underline">
            Log a session
          </Link>
        </div>
      </div>
    );
  }

  notFound();
}
