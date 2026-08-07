"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { importedVitalSampleSchema, importedMindfulSessionSchema } from "@/domains/vitals/schema";
import type { VitalQuantityType } from "@/domains/vitals/types";
import { insertImportedHealthMetric } from "@/platform/health/metrics";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

/** Insert path for imported data — see the matching note in
 * domains/weight/service.ts's insertImportedWeightLog for the dedup/
 * user_override skip logic (identical here, via insertImportedHealthMetric).
 * One shared function for all 16 types since they're all the same shape;
 * metricType is bound per-call rather than parsed from input (see the
 * per-type wrappers built from this in app/api/health-sync/route.ts). */
export async function insertImportedVitalLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: VitalQuantityType,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedVitalSampleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  return insertImportedHealthMetric(supabase, userId, metricType, {
    startedAt: new Date(parsed.data.loggedAt).toISOString(),
    value: parsed.data.value,
    unit: parsed.data.unit,
    source: parsed.data.source,
    device: parsed.data.device ?? null,
    dedupKey: parsed.data.dedupKey,
  });
}

export async function insertImportedMindfulMinutesLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedMindfulSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  return insertImportedHealthMetric(supabase, userId, "mindful_minutes", {
    startedAt: new Date(parsed.data.startDate).toISOString(),
    endedAt: new Date(parsed.data.endDate).toISOString(),
    source: parsed.data.source,
    device: parsed.data.device ?? null,
    dedupKey: parsed.data.dedupKey,
  });
}
