import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { todayForUser } from "@/domains/activity-summary/service";
import { midweekCheck } from "@/domains/review/midweek";

/**
 * Mid-week course correction for the Today screen: one sentence, only
 * when the plan and the week have already come apart and there is still
 * time to act. Usually returns `{ signal: null }`, which is the point —
 * see domains/review/midweek.ts.
 *
 * Read-only and cheap enough to call on every Today load; the decision
 * itself is pure, this only gathers the week's state.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const today = await todayForUser(supabase, userId);
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(today, -dayOfWeek);

  const [{ data: workoutPlans }, { data: mealPlans }, { data: workouts }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("week_start, workout_plan_items(day_of_week, completed_at)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("week_start", weekStart),
    supabase
      .from("meal_plans")
      .select("week_start, meal_plan_items(day_of_week, skipped_at)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("week_start", weekStart),
    supabase
      .from("health_metrics")
      .select("started_at")
      .eq("user_id", userId)
      .eq("metric_type", "workout")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${today}T23:59:59.999Z`),
  ]);

  // One entry per planned training day, collapsing the several exercises
  // a day holds: the question is whether the day happened.
  const byDay = new Map<number, boolean>();
  for (const plan of workoutPlans ?? []) {
    for (const item of plan.workout_plan_items ?? []) {
      byDay.set(item.day_of_week, (byDay.get(item.day_of_week) ?? false) || item.completed_at !== null);
    }
  }
  const plannedTrainingDays = [...byDay.entries()].map(([dow, done]) => ({ done, inPast: dow < dayOfWeek }));
  const plannedDayNumbers = new Set(byDay.keys());

  const trainedDayNumbers = new Set(
    (workouts ?? []).map((w) => new Date(`${w.started_at.slice(0, 10)}T00:00:00Z`).getUTCDay())
  );
  const unplannedTrainingDays = [...trainedDayNumbers].filter((d) => !plannedDayNumbers.has(d)).length;

  // Only days that have already happened: a meal still ahead has not
  // been turned down, it just hasn't arrived.
  const mealItems = (mealPlans ?? []).flatMap((p) => p.meal_plan_items ?? []).filter((m) => m.day_of_week < dayOfWeek);

  const signal = midweekCheck({
    dayOfWeek,
    plannedTrainingDays,
    unplannedTrainingDays,
    mealsPlannedSoFar: mealItems.length,
    mealsSkippedSoFar: mealItems.filter((m) => m.skipped_at !== null).length,
  });

  return NextResponse.json({ signal });
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
