import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { localDateString } from "@/domains/activity-summary/timezone";

/** CLAUDE.md §7 Layer 3 lists streaks as a derived metric ("Do not use an
 * LLM for calculations that code can perform") but it was never
 * implemented anywhere in the codebase until now. Computed server-side
 * (not per-platform) so web and mobile can never quietly disagree — see
 * this feature's plan doc for why. */
export type StreakFacts = {
  currentLoggingStreakDays: number;
  bestLoggingStreakDays: number;
  currentAllTasksCompleteWeeks: number;
};

const WINDOW_DAYS = 60;

function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function longestConsecutiveRun(loggedDates: Set<string>, windowStart: string, windowEnd: string): number {
  let longest = 0;
  let current = 0;
  let cursor = windowStart;
  while (cursor <= windowEnd) {
    if (loggedDates.has(cursor)) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    cursor = addDaysToDateString(cursor, 1);
  }
  return longest;
}

function currentStreak(loggedDates: Set<string>, today: string): number {
  // A day that hasn't ended yet with no log so far shouldn't zero out an
  // otherwise-live streak — check today first, but fall back to counting
  // from yesterday if nothing's logged yet today.
  let cursor = loggedDates.has(today) ? today : addDaysToDateString(today, -1);
  if (!loggedDates.has(cursor)) return 0;
  let streak = 0;
  while (loggedDates.has(cursor)) {
    streak++;
    cursor = addDaysToDateString(cursor, -1);
  }
  return streak;
}

/**
 * Deterministic streak calculator (no LLM). `today`/`windowStart` are the
 * caller's already-timezone-resolved local dates (via `todayForUser`) —
 * this module does no timezone resolution of its own beyond bucketing
 * `health_metrics.started_at` timestamps into local calendar days.
 */
export async function computeStreaks(
  supabase: SupabaseClient<Database>,
  userId: string,
  timezone: string,
  today: string
): Promise<StreakFacts> {
  const windowStart = addDaysToDateString(today, -WINDOW_DAYS);

  const [{ data: healthMetrics }, { data: nutritionLogs }, { data: recoveryLogs }, { data: studySessions }, { data: actions }] =
    await Promise.all([
      supabase
        .from("health_metrics")
        .select("started_at, metric_type")
        .eq("user_id", userId)
        .in("metric_type", ["weight", "sleep"])
        .gte("started_at", `${windowStart}T00:00:00.000Z`),
      supabase.from("nutrition_logs").select("date").eq("user_id", userId).gte("date", windowStart),
      supabase.from("recovery_logs").select("date").eq("user_id", userId).gte("date", windowStart),
      supabase.from("study_sessions").select("date").eq("user_id", userId).gte("date", windowStart),
      supabase.from("daily_actions").select("date, status").eq("user_id", userId).gte("date", windowStart),
    ]);

  const loggedDates = new Set<string>([
    ...(healthMetrics ?? []).map((m) => localDateString(new Date(m.started_at), timezone)),
    ...(nutritionLogs ?? []).map((n) => n.date),
    ...(recoveryLogs ?? []).map((r) => r.date),
    ...(studySessions ?? []).map((s) => s.date),
    ...(actions ?? [])
      .filter((a) => a.status === "completed" || a.status === "partially_completed")
      .map((a) => a.date),
  ]);

  const currentLoggingStreakDays = currentStreak(loggedDates, today);
  const bestLoggingStreakDays = longestConsecutiveRun(loggedDates, windowStart, today);

  // Rolling 7-day weeks ending on `today`, matching reviewWeekStart's own
  // definition (not calendar Sun-Sat) — walk backward one week at a time
  // from the current week until a week has no tasks at all (can't call an
  // empty week "complete") or has any task that isn't
  // completed/partially_completed.
  let currentAllTasksCompleteWeeks = 0;
  let weekEnd = today;
  const actionsByWeek = actions ?? [];
  for (let i = 0; i < Math.floor(WINDOW_DAYS / 7); i++) {
    const weekStart = addDaysToDateString(weekEnd, -6);
    const weekTasks = actionsByWeek.filter((a) => a.date >= weekStart && a.date <= weekEnd);
    if (weekTasks.length === 0) break;
    const allComplete = weekTasks.every((a) => a.status === "completed" || a.status === "partially_completed");
    if (!allComplete) break;
    currentAllTasksCompleteWeeks++;
    weekEnd = addDaysToDateString(weekStart, -1);
  }

  return { currentLoggingStreakDays, bestLoggingStreakDays, currentAllTasksCompleteWeeks };
}
