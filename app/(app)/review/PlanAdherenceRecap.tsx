import { getMealPlanForWeek } from "@/domains/mealplan/service";
import { getWorkoutPlanForWeek } from "@/domains/workoutplan/service";
import { getWeekDates, DAY_NAMES } from "@/platform/ui/week-dates";
import { Card } from "@/platform/ui/Card";

function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

/**
 * Review tab's "Plan Recap" sub-tab — this week's meal/workout completion,
 * reusing the same completed_at flags PlanWeekCalendar already reads
 * (getMealPlanForWeek/getWorkoutPlanForWeek) rather than a new
 * deterministic computation. Purely a UI reduction over existing data,
 * matching areta-mobile's PlanAdherenceRecap.tsx.
 */
export async function PlanAdherenceRecap({ userId, weekStart }: { userId: string; weekStart: string }) {
  const [mealPlan, workoutPlan] = await Promise.all([
    getMealPlanForWeek(userId, weekStart),
    getWorkoutPlanForWeek(userId, weekStart),
  ]);

  const weekDates = getWeekDates(weekStart);
  const days = DAY_NAMES.map((dayName, day) => {
    const meals = (mealPlan?.items ?? []).filter((i) => i.dayOfWeek === day);
    const workouts = (workoutPlan?.items ?? []).filter((i) => i.dayOfWeek === day);
    return {
      date: weekDates[day],
      dayName,
      meals,
      workouts,
      total: meals.length + workouts.length,
      completed: meals.filter((m) => m.completedAt !== null).length + workouts.filter((w) => w.completedAt !== null).length,
    };
  });

  const totalMeals = days.reduce((sum, d) => sum + d.meals.length, 0);
  const completedMeals = days.reduce((sum, d) => sum + d.meals.filter((m) => m.completedAt !== null).length, 0);
  const totalWorkouts = days.reduce((sum, d) => sum + d.workouts.length, 0);
  const completedWorkouts = days.reduce((sum, d) => sum + d.workouts.filter((w) => w.completedAt !== null).length, 0);
  const totalItems = totalMeals + totalWorkouts;
  const completedItems = completedMeals + completedWorkouts;
  const overallPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null;

  return (
    <div className="space-y-6">
      <Card tone="surface">
        <p className="text-xs text-neutral-500">Overall completion</p>
        <p className="mt-1 text-3xl font-bold">{overallPercent !== null ? `${overallPercent}%` : "No plan yet"}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {completedItems} of {totalItems} planned meals + workouts done
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card tone="surface">
          <p className="text-xs text-neutral-500">Meals</p>
          <p className="mt-1 text-lg font-semibold">
            {completedMeals}/{totalMeals}
          </p>
        </Card>
        <Card tone="surface">
          <p className="text-xs text-neutral-500">Workouts</p>
          <p className="mt-1 text-lg font-semibold">
            {completedWorkouts}/{totalWorkouts}
          </p>
        </Card>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Day by day</p>
        <div className="mt-2 flex justify-between">
          {days.map((day) => {
            const allDone = day.total > 0 && day.completed === day.total;
            const someDone = day.completed > 0 && day.completed < day.total;
            const dotClass =
              day.total === 0
                ? "bg-neutral-200 dark:bg-neutral-800"
                : allDone
                  ? "bg-accent"
                  : someDone
                    ? "bg-amber-400"
                    : "bg-neutral-200 dark:bg-neutral-800";
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-neutral-500">{formatShortDate(day.date)}</span>
                <span className={`h-3.5 w-3.5 rounded-full ${dotClass}`} />
                <span className="text-[10px] text-neutral-400">{day.total > 0 ? `${day.completed}/${day.total}` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
