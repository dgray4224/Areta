import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { localDateString } from "@/domains/activity-summary/timezone";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { itemsToAutoComplete, type PlannedItem, type RecordedWorkout } from "@/domains/workoutplan/auto-complete";

/**
 * Turns imported Apple Health workouts into plan adherence, on the days a
 * sync just touched. Runs after the response in app/api/health-sync, next
 * to the same-day record check and under the same contract: the phone
 * never waits on it, and it never throws — a failure here costs a tick,
 * not a sync.
 *
 * See domains/workoutplan/auto-complete.ts for why the match is
 * day-level rather than per-exercise.
 */
export async function autoCompletePlannedWorkouts(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: ReadonlySet<string>
): Promise<{ completed: number }> {
  try {
    if (days.size === 0) return { completed: 0 };
    const dayList = [...days].sort();
    const timezone = await resolveTimezone(supabase, userId);

    // Plan items land on week_start + day_of_week, so fetch the weeks the
    // touched days could belong to and compute each item's real date.
    const weekStarts = new Set(dayList.map(mondayAgnosticWeekStart));
    const { data: plans, error: planError } = await supabase
      .from("workout_plans")
      .select("id, week_start, workout_plan_items(id, day_of_week, completed_at)")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("week_start", [...weekStarts]);
    if (planError || !plans) return { completed: 0 };

    const plannedItems: PlannedItem[] = [];
    for (const plan of plans) {
      for (const item of plan.workout_plan_items ?? []) {
        plannedItems.push({
          id: item.id,
          date: addDaysToDateString(plan.week_start, item.day_of_week),
          completedAt: item.completed_at,
        });
      }
    }
    if (plannedItems.length === 0) return { completed: 0 };

    // Widen by a day on each side before filtering in local time: a
    // workout at 11pm local can carry a UTC timestamp on the next date.
    const { data: workouts, error: workoutError } = await supabase
      .from("health_metrics")
      .select("started_at, ended_at")
      .eq("user_id", userId)
      .eq("metric_type", "workout")
      .gte("started_at", `${addDaysToDateString(dayList[0], -1)}T00:00:00Z`)
      .lte("started_at", `${addDaysToDateString(dayList[dayList.length - 1], 1)}T23:59:59Z`);
    if (workoutError || !workouts) return { completed: 0 };

    const recordedWorkouts: RecordedWorkout[] = workouts
      .filter((w) => w.ended_at !== null)
      .map((w) => ({
        date: localDateString(new Date(w.started_at), timezone),
        durationMinutes: Math.round((new Date(w.ended_at as string).getTime() - new Date(w.started_at).getTime()) / 60000),
      }));

    const ids = itemsToAutoComplete({ plannedItems, recordedWorkouts });
    if (ids.length === 0) return { completed: 0 };

    const { error: updateError } = await supabase
      .from("workout_plan_items")
      .update({ completed_at: new Date().toISOString(), completed_source: "health" })
      .in("id", ids)
      .eq("user_id", userId)
      // Re-checked at write time: a sync and a tap can race, and the
      // person's own tap must win.
      .is("completed_at", null);
    if (updateError) return { completed: 0 };

    return { completed: ids.length };
  } catch {
    return { completed: 0 };
  }
}

/** The plan's own week anchor. Plans are Sunday-normalized (weekStartFor),
 * so a date's week starts on the preceding Sunday. */
function mondayAgnosticWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return addDaysToDateString(date, -d.getUTCDay());
}

function addDaysToDateString(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
