"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { importedWorkoutLogSchema } from "@/domains/workout/schema";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

/** Insert path for imported data — see the matching note in
 * domains/weight/service.ts's insertImportedWeightLog for the dedup/
 * user_override skip logic and why this takes an explicit client
 * (identical here). */
export async function insertImportedWorkoutLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedWorkoutLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("user_override")
    .eq("user_id", userId)
    .eq("dedup_key", parsed.data.dedupKey)
    .maybeSingle();

  if (existing?.user_override) {
    return { ok: true, data: { skipped: true } };
  }

  const { error } = await supabase.from("workout_logs").upsert(
    {
      user_id: userId,
      start_date: new Date(parsed.data.startDate).toISOString(),
      end_date: new Date(parsed.data.endDate).toISOString(),
      activity_type: parsed.data.activityType,
      duration_minutes: parsed.data.durationMinutes,
      total_energy_burned_kcal: parsed.data.totalEnergyBurnedKcal ?? null,
      total_distance_meters: parsed.data.totalDistanceMeters ?? null,
      source: parsed.data.source,
      device: parsed.data.device ?? null,
      imported_at: new Date().toISOString(),
      dedup_key: parsed.data.dedupKey,
    },
    { onConflict: "user_id,dedup_key" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { skipped: false } };
}

export async function getRecentWorkoutLogs(userId: string, days = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "id, start_date, end_date, activity_type, duration_minutes, total_energy_burned_kcal, total_distance_meters, source"
    )
    .eq("user_id", userId)
    .gte("start_date", since)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load workout logs: ${error.message}`);
  }
  return data ?? [];
}
