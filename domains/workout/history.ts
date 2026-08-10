import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import { getRecentWorkoutLogs } from "./service";

export type ExerciseHistoryDay = { date: string; caloriesBurned: number; exerciseMinutes: number };

/**
 * Last N days of HealthKit-synced workout activity (Exercise tab's
 * history chart), aggregated by the user's own local calendar day — same
 * zone-aware bucketing activity_daily_summaries uses, not a UTC-day
 * approximation. A fresh aggregation over workout_logs rather than
 * reading activity_daily_summaries: that table tracks
 * workout_total_minutes but was never extended with a calories column,
 * and this needs both from the same source so a day's two numbers can't
 * drift out of sync. Shared by the mobile bearer route
 * (app/api/exercise/history/route.ts) and the web app's own exercise
 * domain page.
 */
export async function getExerciseHistory(
  userId: string,
  days = 7,
  client?: SupabaseClient<Database>
): Promise<ExerciseHistoryDay[]> {
  const supabase = client ?? (await createClient());
  const timezone = await resolveTimezone(supabase, userId);

  // Fetch one extra day of buffer — getRecentWorkoutLogs' window is a
  // rolling N*24h in UTC, which can clip the earliest local day by a few
  // hours depending on the user's offset. The day-string keys below are
  // what actually decide inclusion, so the buffer only prevents a
  // dropped edge case, never double-counts.
  const logs = await getRecentWorkoutLogs(userId, days + 1, supabase);

  const totalsByDay = new Map<string, { caloriesBurned: number; exerciseMinutes: number }>();
  const orderedDays: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDateString(new Date(Date.now() - i * 24 * 60 * 60 * 1000), timezone);
    orderedDays.push(day);
    totalsByDay.set(day, { caloriesBurned: 0, exerciseMinutes: 0 });
  }

  for (const log of logs) {
    const day = localDateString(new Date(log.start_date), timezone);
    const totals = totalsByDay.get(day);
    if (!totals) continue; // outside the window we actually want
    totals.exerciseMinutes += log.duration_minutes ?? 0;
    totals.caloriesBurned += log.total_energy_burned_kcal ?? 0;
  }

  return orderedDays.map((day) => ({
    date: day,
    caloriesBurned: Math.round(totalsByDay.get(day)!.caloriesBurned),
    exerciseMinutes: totalsByDay.get(day)!.exerciseMinutes,
  }));
}
