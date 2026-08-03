import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { localDateString, localDayUtcRange } from "@/domains/activity-summary/timezone";
import { aggregateActivityDailySummary } from "@/domains/activity-summary/aggregate";

// Not a Server Action file -- only ever called from other server code
// (insertImported*Log / logWeight / logSleep), never invoked directly by a
// client form. Matches domains/review/metrics.ts's / domains/sleep/
// duration.ts's precedent of plain, non-Server-Action modules.

const DEFAULT_TIMEZONE = "UTC";

export async function resolveTimezone(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("time_zone").eq("id", userId).maybeSingle();
  return profile?.time_zone ?? DEFAULT_TIMEZONE;
}

async function recomputeForDayAndTimezone(
  supabase: SupabaseClient<Database>,
  userId: string,
  day: string,
  timezone: string
): Promise<void> {
  const { start, end } = localDayUtcRange(day, timezone);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [{ data: workoutLogs }, { data: weightLogs }, { data: stepLogs }, { data: sleepLogs }, { data: heartRateLogs }] =
    await Promise.all([
      supabase
        .from("workout_logs")
        .select("start_date, duration_minutes, activity_type")
        .eq("user_id", userId)
        .gte("start_date", startIso)
        .lt("start_date", endIso),
      supabase
        .from("weight_logs")
        .select("logged_at, weight, unit")
        .eq("user_id", userId)
        .gte("logged_at", startIso)
        .lt("logged_at", endIso),
      supabase
        .from("step_logs")
        .select("logged_at, count")
        .eq("user_id", userId)
        .gte("logged_at", startIso)
        .lt("logged_at", endIso),
      // sleep_logs.date is already a plain local date -- direct equality,
      // no UTC-range conversion needed (unlike the four timestamptz tables).
      supabase.from("sleep_logs").select("total_duration_minutes, quality").eq("user_id", userId).eq("date", day),
      supabase
        .from("heart_rate_logs")
        .select("bpm")
        .eq("user_id", userId)
        .gte("logged_at", startIso)
        .lt("logged_at", endIso),
    ]);

  const summary = aggregateActivityDailySummary({
    userId,
    day,
    timezone,
    workoutLogs: workoutLogs ?? [],
    // unit is a plain `text` column DB-side (CHECK-constrained to
    // 'lb'|'kg', not a Postgres enum), so the generated type widens it to
    // `string` -- the cast reflects a constraint the DB already enforces.
    weightLogs: (weightLogs ?? []) as { logged_at: string; weight: number; unit: "lb" | "kg" }[],
    stepLogs: stepLogs ?? [],
    sleepLogs: sleepLogs ?? [],
    heartRateLogs: heartRateLogs ?? [],
  });

  const { error } = await supabase.from("activity_daily_summaries").upsert(summary, { onConflict: "user_id,day" });

  if (error) {
    console.error("[activity-summary] upsert failed", { userId, day, error });
  }
}

/**
 * Recomputes and upserts the activity_daily_summaries row for whichever
 * local day `instant` falls on, for the four timestamptz-based domains
 * (weight, steps, heart rate, workout). Never throws -- a recompute failure
 * must not surface as a failure of the primary log write that triggered it,
 * which has already succeeded by the time this runs.
 */
export async function recomputeActivityDailySummaryForInstant(
  supabase: SupabaseClient<Database>,
  userId: string,
  instant: Date
): Promise<void> {
  try {
    const timezone = await resolveTimezone(supabase, userId);
    const day = localDateString(instant, timezone);
    await recomputeForDayAndTimezone(supabase, userId, day, timezone);
  } catch (err) {
    console.error("[activity-summary] recompute (instant) failed", { userId, err });
  }
}

/**
 * Same as recomputeActivityDailySummaryForInstant, but for sleep_logs,
 * whose `date` column is already a plain local calendar date with no
 * timezone conversion needed -- skips the instant-to-local-day derivation
 * and recomputes directly for the given day.
 */
export async function recomputeActivityDailySummaryForDay(
  supabase: SupabaseClient<Database>,
  userId: string,
  day: string
): Promise<void> {
  try {
    const timezone = await resolveTimezone(supabase, userId);
    await recomputeForDayAndTimezone(supabase, userId, day, timezone);
  } catch (err) {
    console.error("[activity-summary] recompute (day) failed", { userId, err });
  }
}
