"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { weightLogSchema, importedWeightLogSchema } from "@/domains/weight/schema";
import { createClient } from "@/platform/supabase/server";
import { insertManualHealthMetric, insertImportedHealthMetric } from "@/platform/health/metrics";
import { recomputeActivityDailySummaryForInstant } from "@/domains/activity-summary/service";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function logWeight(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = weightLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const result = await insertManualHealthMetric(supabase, userId, "weight", {
    startedAt: new Date(parsed.data.loggedAt).toISOString(),
    value: parsed.data.weight,
    unit: parsed.data.unit,
    notes: parsed.data.notes || null,
  });

  if (!result.ok) {
    return result;
  }
  await recomputeActivityDailySummaryForInstant(supabase, userId, new Date(parsed.data.loggedAt));
  return { ok: true, data: undefined };
}

/**
 * Insert path for imported data (CLAUDE.md §14) — a HealthKit companion app
 * or similar posting to /api/health-sync. Upserts on (user_id, metric_type,
 * dedup_key) so a retried sync can't double-insert the same sample, and
 * skips overwriting a row the user already hand-corrected (user_override),
 * so a manual correction always wins over a re-import of the original value.
 * See platform/health/metrics.ts for the shared retention/dedup/upsert logic.
 *
 * Takes an explicit client rather than constructing one internally like
 * every other function in this file — the cookie-bound createClient() only
 * works for browser requests with a session cookie, but /api/health-sync
 * authenticates a native app via a bearer token instead, so it must supply
 * a client already scoped to that user's RLS context.
 */
export async function insertImportedWeightLog(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown
): Promise<ActionResult<{ skipped: boolean }>> {
  const parsed = importedWeightLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await insertImportedHealthMetric(supabase, userId, "weight", {
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

export async function getRecentWeightLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_metrics")
    .select("id, started_at, value, unit, notes")
    .eq("user_id", userId)
    .eq("metric_type", "weight")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load weight logs: ${error.message}`);
  }
  // Preserve the pre-migration column names (logged_at, weight) for every
  // caller of this function — only this file and insertImportedWeightLog
  // know health_metrics' generic column names.
  // value/unit are nullable at the health_metrics schema level (most of its
  // 23 metric types don't use them), but every weight row always has both
  // set — insertManualHealthMetric/insertImportedHealthMetric are never
  // called for metric_type "weight" without them.
  return (data ?? []).map((row) => ({
    id: row.id,
    logged_at: row.started_at,
    weight: Number(row.value),
    unit: row.unit as "lb" | "kg",
    notes: row.notes,
  }));
}
