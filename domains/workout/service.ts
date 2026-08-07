"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { importedWorkoutLogSchema } from "@/domains/workout/schema";
import { createClient } from "@/platform/supabase/server";
import { isOlderThanHealthImportRetentionWindow } from "@/platform/health/retention";
import { insertImportedHealthMetric } from "@/platform/health/metrics";
import { recomputeActivityDailySummaryForInstant, resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString, localTimeString } from "@/domains/activity-summary/timezone";
import { logScheduleEvent } from "@/platform/scheduling/log-schedule-event";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

/** Insert path for imported data — see the matching note in
 * domains/weight/service.ts's insertImportedWeightLog for the dedup/
 * user_override skip logic and why this takes an explicit client
 * (identical here). Workout keeps its own wrapper (rather than a thin
 * one-liner like steps/heart-rate) because of the logScheduleEvent side
 * effect below and its own id lookup, which insertImportedHealthMetric
 * doesn't return. */
export async function insertImportedWorkoutLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedWorkoutLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // insertImportedHealthMetric doesn't return the row id (needed below for
  // logScheduleEvent), so its retention-skip short-circuit is re-checked
  // here rather than threading an id back through a generic return shape
  // that every other caller doesn't need.
  if (isOlderThanHealthImportRetentionWindow(parsed.data.startDate)) {
    return { ok: true, data: { skipped: true } };
  }

  const result = await insertImportedHealthMetric(supabase, userId, "workout", {
    startedAt: new Date(parsed.data.startDate).toISOString(),
    endedAt: new Date(parsed.data.endDate).toISOString(),
    activityType: parsed.data.activityType,
    totalEnergyBurnedKcal: parsed.data.totalEnergyBurnedKcal ?? null,
    totalDistanceMeters: parsed.data.totalDistanceMeters ?? null,
    source: parsed.data.source,
    device: parsed.data.device ?? null,
    dedupKey: parsed.data.dedupKey,
  });

  if (!result.ok || result.data.skipped) {
    return result;
  }

  const { data: workoutRow, error: lookupError } = await supabase
    .from("health_metrics")
    .select("id")
    .eq("user_id", userId)
    .eq("metric_type", "workout")
    .eq("dedup_key", parsed.data.dedupKey)
    .single();
  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }

  const startInstant = new Date(parsed.data.startDate);
  await recomputeActivityDailySummaryForInstant(supabase, userId, startInstant);

  // Actual synced behavior always wins over a planned/dragged time for
  // the same day (see logScheduleEvent) -- dated by when the workout
  // really happened in the user's own timezone, not by sync time.
  const timezone = await resolveTimezone(supabase, userId);
  await logScheduleEvent(
    userId,
    "workout",
    "workout",
    workoutRow.id,
    localTimeString(startInstant, timezone),
    supabase,
    "actual",
    localDateString(startInstant, timezone)
  );

  return { ok: true, data: { skipped: false } };
}

export async function getRecentWorkoutLogs(userId: string, days = 30, client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("health_metrics")
    .select("id, started_at, ended_at, activity_type, total_energy_burned_kcal, total_distance_meters, source")
    .eq("user_id", userId)
    .eq("metric_type", "workout")
    .gte("started_at", since)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load workout logs: ${error.message}`);
  }
  // Preserve the pre-migration column names/shape for every caller —
  // start_date/end_date/duration_minutes (derived, workout always has a
  // real ended_at, unlike sleep).
  return (data ?? []).map((row) => ({
    id: row.id,
    start_date: row.started_at,
    end_date: row.ended_at,
    // activity_type is nullable at the health_metrics schema level, but
    // every workout row always has one — insertImportedWorkoutLog never
    // omits it (importedWorkoutLogSchema requires it).
    activity_type: row.activity_type ?? "unknown",
    duration_minutes: row.ended_at
      ? Math.round((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000)
      : 0,
    total_energy_burned_kcal: row.total_energy_burned_kcal,
    total_distance_meters: row.total_distance_meters,
    source: row.source,
  }));
}
