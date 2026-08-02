"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sleepLogSchema, importedSleepLogSchema } from "@/domains/sleep/schema";
import { computeSleepDurationMinutes } from "@/domains/sleep/duration";
import { createClient } from "@/platform/supabase/server";
import { isOlderThanHealthImportRetentionWindow } from "@/platform/health/retention";
import { recomputeActivityDailySummaryForDay } from "@/domains/activity-summary/service";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function logSleep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = sleepLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { date, bedtime, wakeTime, totalDurationMinutes, quality, interruptions, notes } =
    parsed.data;

  const duration =
    totalDurationMinutes ??
    (bedtime && wakeTime ? computeSleepDurationMinutes(bedtime, wakeTime) : undefined);

  const supabase = await createClient();
  const { error } = await supabase.from("sleep_logs").insert({
    user_id: userId,
    date,
    bedtime: bedtime ? new Date(bedtime).toISOString() : null,
    wake_time: wakeTime ? new Date(wakeTime).toISOString() : null,
    total_duration_minutes: duration ?? null,
    quality: quality ?? null,
    interruptions: interruptions ?? null,
    notes: notes || null,
  });

  if (error) {
    return { ok: false, error: error.message };
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

  if (isOlderThanHealthImportRetentionWindow(date)) {
    return { ok: true, data: { skipped: true } };
  }

  const duration =
    totalDurationMinutes ??
    (bedtime && wakeTime ? computeSleepDurationMinutes(bedtime, wakeTime) : undefined);

  const { data: existing } = await supabase
    .from("sleep_logs")
    .select("user_override")
    .eq("user_id", userId)
    .eq("dedup_key", dedupKey)
    .maybeSingle();

  if (existing?.user_override) {
    return { ok: true, data: { skipped: true } };
  }

  const { error } = await supabase.from("sleep_logs").upsert(
    {
      user_id: userId,
      date,
      bedtime: bedtime ? new Date(bedtime).toISOString() : null,
      wake_time: wakeTime ? new Date(wakeTime).toISOString() : null,
      total_duration_minutes: duration ?? null,
      quality: quality ?? null,
      interruptions: interruptions ?? null,
      source,
      device: device ?? null,
      imported_at: new Date().toISOString(),
      dedup_key: dedupKey,
    },
    { onConflict: "user_id,dedup_key" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  await recomputeActivityDailySummaryForDay(supabase, userId, date);
  return { ok: true, data: { skipped: false } };
}

export async function getRecentSleepLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sleep_logs")
    .select("id, date, bedtime, wake_time, total_duration_minutes, quality, interruptions, notes")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load sleep logs: ${error.message}`);
  }
  return data ?? [];
}
