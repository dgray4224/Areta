"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { importedHeartRateLogSchema } from "@/domains/heartrate/schema";
import { isOlderThanHealthImportRetentionWindow } from "@/platform/health/retention";
import { recomputeActivityDailySummaryForInstant } from "@/domains/activity-summary/service";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

/** Insert path for imported data — see the matching note in
 * domains/weight/service.ts's insertImportedWeightLog for the dedup/
 * user_override skip logic and why this takes an explicit client
 * (identical here). */
export async function insertImportedHeartRateLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedHeartRateLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (isOlderThanHealthImportRetentionWindow(parsed.data.loggedAt)) {
    return { ok: true, data: { skipped: true } };
  }

  const { data: existing } = await supabase
    .from("heart_rate_logs")
    .select("user_override")
    .eq("user_id", userId)
    .eq("dedup_key", parsed.data.dedupKey)
    .maybeSingle();

  if (existing?.user_override) {
    return { ok: true, data: { skipped: true } };
  }

  const { error } = await supabase.from("heart_rate_logs").upsert(
    {
      user_id: userId,
      logged_at: new Date(parsed.data.loggedAt).toISOString(),
      bpm: parsed.data.bpm,
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
  await recomputeActivityDailySummaryForInstant(supabase, userId, new Date(parsed.data.loggedAt));
  return { ok: true, data: { skipped: false } };
}
