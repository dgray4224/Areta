"use server";

import { sleepLogSchema } from "@/domains/sleep/schema";
import { computeSleepDurationMinutes } from "@/domains/sleep/duration";
import { createClient } from "@/platform/supabase/server";
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
  return { ok: true, data: undefined };
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
