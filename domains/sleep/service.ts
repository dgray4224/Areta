"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sleepLogSchema, importedSleepLogSchema } from "@/domains/sleep/schema";
import { computeSleepDurationMinutes } from "@/domains/sleep/duration";
import { createClient } from "@/platform/supabase/server";
import { insertManualHealthMetric, insertImportedHealthMetric } from "@/platform/health/metrics";
import { recomputeActivityDailySummaryForDay } from "@/domains/activity-summary/service";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

// bedtime/wake_time are both optional in the manual-entry form (a user might
// only know the total duration) — started_at falls back to midnight UTC of
// `date` so health_metrics' not-null started_at constraint always holds.
function sleepStartedAt(date: string, bedtime?: string): string {
  return bedtime ? new Date(bedtime).toISOString() : new Date(date).toISOString();
}

export async function logSleep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = sleepLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { date, bedtime, wakeTime, totalDurationMinutes, quality, interruptions, notes } = parsed.data;

  // Duration is stored explicitly in `value` (minutes), independent of the
  // bedtime/wake_time span — a user may log a bed-time window that includes
  // time spent awake, so "time in bed" and "actual sleep duration" can
  // legitimately differ (same distinction HealthKit's own sleep-stage import
  // makes by filtering out awake samples — see areta-mobile's lib/healthkit.ts).
  const duration =
    totalDurationMinutes ?? (bedtime && wakeTime ? computeSleepDurationMinutes(bedtime, wakeTime) : undefined);

  const supabase = await createClient();
  const result = await insertManualHealthMetric(supabase, userId, "sleep", {
    startedAt: sleepStartedAt(date, bedtime),
    endedAt: wakeTime ? new Date(wakeTime).toISOString() : null,
    value: duration ?? null,
    unit: duration != null ? "min" : null,
    sleepQuality: quality ?? null,
    sleepInterruptions: interruptions ?? null,
    notes: notes || null,
  });

  if (!result.ok) {
    return result;
  }
  await recomputeActivityDailySummaryForDay(supabase, userId, date);
  return { ok: true, data: undefined };
}

/** Insert path for imported data — see the matching note in
 * domains/weight/service.ts's insertImportedWeightLog for the dedup/
 * user_override skip logic and why this takes an explicit client
 * (identical here). */
export async function insertImportedSleepLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedSleepLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { date, bedtime, wakeTime, totalDurationMinutes, quality, interruptions, source, device, dedupKey } =
    parsed.data;

  const duration =
    totalDurationMinutes ?? (bedtime && wakeTime ? computeSleepDurationMinutes(bedtime, wakeTime) : undefined);

  const result = await insertImportedHealthMetric(supabase, userId, "sleep", {
    startedAt: sleepStartedAt(date, bedtime),
    endedAt: wakeTime ? new Date(wakeTime).toISOString() : null,
    value: duration ?? null,
    unit: duration != null ? "min" : null,
    sleepQuality: quality ?? null,
    sleepInterruptions: interruptions ?? null,
    source,
    device: device ?? null,
    dedupKey,
  });

  if (!result.ok || result.data.skipped) {
    return result;
  }
  await recomputeActivityDailySummaryForDay(supabase, userId, date);
  return result;
}

export async function getRecentSleepLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_metrics")
    .select("id, started_at, ended_at, value, sleep_quality, sleep_interruptions, notes")
    .eq("user_id", userId)
    .eq("metric_type", "sleep")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load sleep logs: ${error.message}`);
  }
  // Preserve the pre-migration column names/shape for every caller —
  // date/bedtime/wake_time/total_duration_minutes/quality/interruptions.
  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.started_at.slice(0, 10),
    bedtime: row.started_at,
    wake_time: row.ended_at,
    total_duration_minutes: row.value,
    quality: row.sleep_quality,
    interruptions: row.sleep_interruptions,
    notes: row.notes,
  }));
}
