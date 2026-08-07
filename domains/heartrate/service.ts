"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { importedHeartRateLogSchema } from "@/domains/heartrate/schema";
import { insertImportedHealthMetric } from "@/platform/health/metrics";
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

  const result = await insertImportedHealthMetric(supabase, userId, "heart_rate", {
    startedAt: new Date(parsed.data.loggedAt).toISOString(),
    value: parsed.data.value,
    unit: parsed.data.unit,
    source: parsed.data.source,
    device: parsed.data.device ?? null,
    dedupKey: parsed.data.dedupKey,
  });

  if (!result.ok || result.data.skipped) {
    return result;
  }
  await recomputeActivityDailySummaryForInstant(supabase, userId, new Date(parsed.data.loggedAt));
  return result;
}
