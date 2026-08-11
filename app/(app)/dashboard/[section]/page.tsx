import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getActiveDomainsForSection } from "@/platform/ui/sections";
import { getDashboardData } from "../data";
import { getDashboardTrends } from "../trends-data";
import { DayTimeline, type TimelineMeal, type TimelineWorkout } from "./DayTimeline";
import { getActivePrompt } from "@/domains/prompts/service";
import { PromptCard } from "./PromptCard";
import { getActiveMealPlan } from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { getNutritionLogsForDate } from "@/domains/nutrition/log-service";
import { NutritionToday, type PlannedMealView, type LoggedFoodView } from "./NutritionToday";
import { getActiveWorkoutPlan } from "@/domains/workoutplan/service";
import { getExercisesByIds, getAllExercises } from "@/domains/exerciselibrary/service";
import { getRecentExerciseLogs } from "@/domains/exercise/service";
import { getRecentWorkoutLogs } from "@/domains/workout/service";
import { getExerciseHistory } from "@/domains/workout/history";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import { ExerciseToday, type PlannedExerciseView, type SyncedWorkoutView } from "./ExerciseToday";
import { WeightTrendChart } from "@/platform/ui/charts/WeightTrendChart";
import { SleepTrendChart } from "@/platform/ui/charts/SleepTrendChart";
import { NutritionAdherenceChart } from "@/platform/ui/charts/NutritionAdherenceChart";
import { VitalsMiniChart } from "@/platform/ui/charts/VitalsMiniChart";

const RECENT_FOODS_LOOKBACK_DAYS = 6;

function shiftDateString(dateString: string, deltaDays: number): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard's single consolidated "Today" page — replaces the old
 * Overview/Nutrition/Exercise/Sleep sub-tab split (DomainNav.tsx,
 * [domain]/page.tsx, now deleted) with one page holding everything at
 * once, per explicit user direction ("no sub tabs... enough space on
 * desktop"). Nutrition/Exercise's interactive cores (NutritionToday.tsx,
 * ExerciseToday.tsx) are unchanged, just moved up a directory and
 * rendered inline instead of behind a route; Sleep (previously its own
 * thin page with just a trend chart) folds in the same way.
 *
 * Also replaces ScheduleTimeline.tsx's flat two-column list with
 * DayTimeline.tsx's real hour-grid visualization, and retires the
 * "Progress" bar + TaskCompletionChart that were silently dead — both
 * were driven by the deprecated daily_actions/tasks table, which nothing
 * has written to since AddTaskForm.tsx was deleted (see the mobile
 * parity IA-trim). Replaced with a completion summary computed from
 * today's real scheduled items (meals + workout + custom tasks) instead.
 */
export default async function DashboardSectionSummaryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const data = await getDashboardData(user.id);
  const trends = await getDashboardTrends(user.id);
  const activePrompt = await getActivePrompt(user.id);

  const activeDomainKeys = data.domains.map((d) => d.key);
  const activeDomains = getActiveDomainsForSection("health", activeDomainKeys);
  const showNutrition = activeDomains.includes("nutrition");
  const showExercise = activeDomains.includes("exercise");
  const showSleep = activeDomains.includes("sleep");

  const dow = new Date(`${data.today}T00:00:00Z`).getUTCDay();

  const [mealPlan, workoutPlan, { data: schedulePrefs }] = await Promise.all([
    showNutrition ? getActiveMealPlan(user.id, supabase, data.today) : Promise.resolve(null),
    showExercise ? getActiveWorkoutPlan(user.id, supabase, data.today) : Promise.resolve(null),
    // DayTimeline's grid range -- getDashboardData's own profile shape
    // doesn't carry these (only fullName/onboardingCompletedAt), so a
    // small direct query here rather than widening that shared type for
    // one caller.
    supabase.from("profiles").select("wake_time, bed_time").eq("id", user.id).maybeSingle(),
  ]);

  const todaysMealItems = mealPlan?.items.filter((item) => item.dayOfWeek === dow) ?? [];
  const todaysWorkoutItems = workoutPlan?.items.filter((item) => item.dayOfWeek === dow) ?? [];

  // ---- Nutrition section data (only fetched/rendered if active) ----
  let nutritionSection: { plannedMeals: PlannedMealView[]; logs: LoggedFoodView[]; recentFoodNames: string[] } | null = null;
  if (showNutrition) {
    const recipeMap = await getRecipesByIds(todaysMealItems.map((i) => i.recipeId), supabase);
    const [todaysLogs, recentDaysLogs] = await Promise.all([
      getNutritionLogsForDate(user.id, data.today, supabase),
      Promise.all(
        Array.from({ length: RECENT_FOODS_LOOKBACK_DAYS }, (_, i) =>
          getNutritionLogsForDate(user.id, shiftDateString(data.today, -(i + 1)), supabase).catch(() => [])
        )
      ),
    ]);
    nutritionSection = {
      plannedMeals: todaysMealItems.map((item) => {
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
      }),
      logs: todaysLogs.map((l) => ({ ...l, meal: l.meal as LoggedFoodView["meal"] })),
      recentFoodNames: recentDaysLogs.flat().map((l) => l.food),
    };
  }

  // ---- Exercise section data (only fetched/rendered if active) ----
  let exerciseSection: {
    plannedExercises: PlannedExerciseView[];
    exerciseLibrary: Awaited<ReturnType<typeof getAllExercises>>;
    syncedWorkouts: SyncedWorkoutView[];
    sessionsPerWeek: number | null;
    recentLogs: Awaited<ReturnType<typeof getRecentExerciseLogs>>;
    history: Awaited<ReturnType<typeof getExerciseHistory>>;
  } | null = null;
  if (showExercise) {
    const [exerciseMap, exerciseLibrary, sessionsPerWeek, recentLogs, todaysWorkoutLogsRaw, history] = await Promise.all([
      getExercisesByIds(todaysWorkoutItems.map((i) => i.exerciseId), supabase),
      getAllExercises(supabase),
      getApprovedParameterValue(user.id, "exercise", "sessions_per_week"),
      getRecentExerciseLogs(user.id, 14),
      getRecentWorkoutLogs(user.id, 1, supabase),
      getExerciseHistory(user.id, 7, supabase),
    ]);
    exerciseSection = {
      plannedExercises: todaysWorkoutItems.map((item) => ({
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
      })),
      exerciseLibrary,
      // getRecentWorkoutLogs(days: 1) is a rolling 24h window, not "today"
      // by calendar day -- filter to the user's actual local today so
      // this list and the history chart never disagree about "today."
      syncedWorkouts: todaysWorkoutLogsRaw
        .filter((log) => log.start_date.slice(0, 10) === data.today)
        .map((log) => ({
          id: log.id,
          activityType: log.activity_type,
          durationMinutes: log.duration_minutes,
          caloriesBurned: log.total_energy_burned_kcal,
        })),
      sessionsPerWeek,
      recentLogs,
      history,
    };
  }

  // ---- Timeline props ----
  const timelineMeals: TimelineMeal[] = todaysMealItems.map((item) => ({
    id: item.id,
    mealType: item.mealType,
    recipeName: nutritionSection?.plannedMeals.find((m) => m.id === item.id)?.recipeName ?? "Meal",
    scheduledTime: item.scheduledTime,
  }));
  const workoutScheduledTime = todaysWorkoutItems.find((i) => i.scheduledTime)?.scheduledTime ?? null;
  const timelineWorkout: TimelineWorkout = {
    hasActivePlan: showExercise && todaysWorkoutItems.length > 0,
    scheduledTime: workoutScheduledTime,
    exerciseCount: todaysWorkoutItems.length,
    itemIds: todaysWorkoutItems.map((i) => i.id),
  };
  const todaysCalendarEvents = data.upcomingEvents.filter((e) => e.startsAt.slice(0, 10) === data.today);

  // ---- Today's real completion summary (meals + workout + tasks),
  // replacing the dead daily_actions-backed progress bar. ----
  const mealsCompleted = todaysMealItems.filter((i) => i.completedAt).length;
  const workoutCompleted = todaysWorkoutItems.filter((i) => i.completedAt).length;
  const tasksCompleted = data.timelineEvents.filter((e) => e.completedAt).length;
  const totalItems = todaysMealItems.length + todaysWorkoutItems.length + data.timelineEvents.length;
  const completedItems = mealsCompleted + workoutCompleted + tasksCompleted;

  const dateLabel = new Date(`${data.today}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-10 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {data.profile.fullName ?? "there"}</h1>
          <p className="mt-1 text-sm text-neutral-500">{dateLabel}</p>
        </div>
        <Link
          href="/goals"
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/[0.03] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
        >
          Goals
        </Link>
      </div>

      <div className="xl:grid xl:grid-cols-[1fr_320px] xl:items-start xl:gap-8">
        <Card>
          <DayTimeline
            userId={user.id}
            date={data.today}
            wakeTime={schedulePrefs?.wake_time ?? null}
            bedTime={schedulePrefs?.bed_time ?? null}
            calendarEvents={todaysCalendarEvents}
            meals={timelineMeals}
            workout={timelineWorkout}
            customEvents={data.timelineEvents}
          />
        </Card>

        <div className="mt-6 space-y-6 xl:sticky xl:top-6 xl:mt-0 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          {activePrompt ? (
            <PromptCard userId={user.id} triggerId={activePrompt.triggerId} question={activePrompt.question} />
          ) : null}

          <section>
            <h2 className="text-sm font-medium text-neutral-500">Upcoming events</h2>
            {data.upcomingEvents.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {data.upcomingEvents.slice(0, 5).map((event) => (
                  <li key={`${event.source}-${event.id}`} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate">{event.title}</span>
                    <span className="shrink-0 text-neutral-400">
                      {event.allDay
                        ? "All day"
                        : new Date(event.startsAt).toLocaleString(undefined, {
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : data.hasCalendarConnection ? (
              <EmptyState title="Nothing on your calendar this week" />
            ) : (
              <EmptyState
                title="No calendar connected"
                description="Connect Google, Outlook, or Apple Calendar to see what's coming up."
                action={
                  <Link href="/settings/calendar" className="text-sm text-brand underline">
                    Go to settings
                  </Link>
                }
              />
            )}
          </section>

          <section className="space-y-2 border-t border-black/5 pt-6 dark:border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-500">Today&apos;s progress</h2>
              <span className="text-sm text-neutral-500">
                {completedItems} of {totalItems}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-brand-fill transition-all"
                style={{ width: totalItems > 0 ? `${Math.round((completedItems / totalItems) * 100)}%` : "0%" }}
              />
            </div>
          </section>

          {trends.weight.data.length > 0 ? (
            <section className="space-y-2 border-t border-black/5 pt-6 dark:border-white/5">
              <h2 className="text-sm font-medium text-neutral-500">Weight · last 30 days</h2>
              <WeightTrendChart data={trends.weight.data} unit={trends.weight.unit} />
            </section>
          ) : null}
        </div>
      </div>

      {showNutrition && nutritionSection ? (
        <section className="space-y-4 border-t border-black/5 pt-8 dark:border-white/5">
          <h2 className="text-xl font-semibold">Nutrition</h2>
          <NutritionToday
            userId={user.id}
            date={data.today}
            initialPlan={nutritionSection.plannedMeals}
            initialLogs={nutritionSection.logs}
            recentFoodNames={nutritionSection.recentFoodNames}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card tone="surface">
              <p className="mb-1 text-sm font-medium">Calorie adherence · last 30 days</p>
              <NutritionAdherenceChart data={trends.nutrition.data} target={trends.nutrition.target} />
            </Card>
            <div className="flex flex-wrap items-start gap-4 text-sm">
              <Link href="/plan/parameters" className="underline">
                Nutrition targets
              </Link>
              <Link href="/plan/meals" className="underline">
                Meal plan
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {showExercise && exerciseSection ? (
        <section className="space-y-4 border-t border-black/5 pt-8 dark:border-white/5">
          <h2 className="text-xl font-semibold">Exercise</h2>
          <ExerciseToday
            userId={user.id}
            dayOfWeek={dow}
            plan={exerciseSection.plannedExercises}
            exercises={exerciseSection.exerciseLibrary}
            syncedWorkouts={exerciseSection.syncedWorkouts}
          />
          <Card tone="surface">
            <p className="text-sm font-medium text-neutral-500">Target sessions per week</p>
            <p className="text-lg font-medium">{exerciseSection.sessionsPerWeek ?? "Not set yet"}</p>
          </Card>
          <Card tone="surface">
            <p className="mb-2 text-sm font-medium">Last 7 days</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500">Exercise minutes</p>
                <VitalsMiniChart
                  data={exerciseSection.history.map((d) => ({ date: d.date, value: d.exerciseMinutes }))}
                  unit="min"
                  seriesKey="series1"
                />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Calories burned</p>
                <VitalsMiniChart
                  data={exerciseSection.history.map((d) => ({ date: d.date, value: d.caloriesBurned }))}
                  unit="kcal"
                  seriesKey="series2"
                />
              </div>
            </div>
          </Card>
          <div>
            <p className="text-sm font-medium text-neutral-500">Recent logged sessions</p>
            {exerciseSection.recentLogs.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {exerciseSection.recentLogs.map((log) => (
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
          <div className="flex flex-wrap gap-4 text-sm">
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
        </section>
      ) : null}

      {showSleep ? (
        <section className="space-y-4 border-t border-black/5 pt-8 dark:border-white/5">
          <h2 className="text-xl font-semibold">Sleep</h2>
          <Card tone="surface">
            <p className="mb-1 text-sm font-medium">Sleep duration · last 30 days</p>
            <SleepTrendChart data={trends.sleep} />
          </Card>
          <Link href="/log/sleep" className="text-sm underline">
            Log sleep
          </Link>
        </section>
      ) : null}
    </div>
  );
}
