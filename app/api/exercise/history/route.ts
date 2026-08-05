import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getRecentWorkoutLogs } from "@/domains/workout/service";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";

/**
 * Bearer-authenticated read of the last 7 days of HealthKit-synced workout
 * activity (mobile Exercise tab's analytics chart), aggregated by the
 * user's own local calendar day -- same zone-aware bucketing
 * activity_daily_summaries uses (domains/activity-summary/timezone.ts),
 * not a UTC-day approximation. Deliberately a fresh aggregation over
 * workout_logs rather than reading activity_daily_summaries: that table
 * tracks workout_total_minutes but was never extended with a calories
 * column, and this endpoint needs both from the same source so a day's
 * two numbers can't drift out of sync with each other.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const DAYS = 7;
  const timezone = await resolveTimezone(supabase, userId);

  // Fetch one extra day of buffer -- getRecentWorkoutLogs' window is a
  // rolling N*24h in UTC, which can clip the earliest local day by a few
  // hours depending on the user's offset. The day-string keys below are
  // what actually decide inclusion, so the buffer only prevents a
  // dropped edge case, never double-counts.
  const logs = await getRecentWorkoutLogs(userId, DAYS + 1, supabase);

  const totalsByDay = new Map<string, { caloriesBurned: number; exerciseMinutes: number }>();
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = localDateString(new Date(Date.now() - i * 24 * 60 * 60 * 1000), timezone);
    days.push(day);
    totalsByDay.set(day, { caloriesBurned: 0, exerciseMinutes: 0 });
  }

  for (const log of logs) {
    const day = localDateString(new Date(log.start_date), timezone);
    const totals = totalsByDay.get(day);
    if (!totals) continue; // outside the 7-day window we actually want
    totals.exerciseMinutes += log.duration_minutes ?? 0;
    totals.caloriesBurned += log.total_energy_burned_kcal ?? 0;
  }

  return NextResponse.json({
    days: days.map((day) => ({
      date: day,
      caloriesBurned: Math.round(totalsByDay.get(day)!.caloriesBurned),
      exerciseMinutes: totalsByDay.get(day)!.exerciseMinutes,
    })),
  });
}
