"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { weightLogSchema, importedWeightLogSchema } from "@/domains/weight/schema";
import { createClient } from "@/platform/supabase/server";
import { isOlderThanHealthImportRetentionWindow } from "@/platform/health/retention";
import { recomputeActivityDailySummaryForInstant } from "@/domains/activity-summary/service";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function logWeight(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = weightLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("weight_logs").insert({
    user_id: userId,
    logged_at: new Date(parsed.data.loggedAt).toISOString(),
    weight: parsed.data.weight,
    unit: parsed.data.unit,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  await recomputeActivityDailySummaryForInstant(supabase, userId, new Date(parsed.data.loggedAt));
  return { ok: true, data: undefined };
}

/**
 * Insert path for imported data (CLAUDE.md §14) — a HealthKit companion app
 * or similar posting to /api/health-sync. Upserts on (user_id, dedup_key)
 * so a retried sync can't double-insert the same sample, and skips
 * overwriting a row the user already hand-corrected (user_override), so a
 * manual correction always wins over a re-import of the original value.
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

  if (isOlderThanHealthImportRetentionWindow(parsed.data.loggedAt)) {
    return { ok: true, data: { skipped: true } };
  }

  const { data: existing } = await supabase
    .from("weight_logs")
    .select("user_override")
    .eq("user_id", userId)
    .eq("dedup_key", parsed.data.dedupKey)
    .maybeSingle();

  if (existing?.user_override) {
    return { ok: true, data: { skipped: true } };
  }

  const { error } = await supabase.from("weight_logs").upsert(
    {
      user_id: userId,
      logged_at: new Date(parsed.data.loggedAt).toISOString(),
      weight: parsed.data.weight,
      unit: parsed.data.unit,
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

export async function getRecentWeightLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weight_logs")
    .select("id, logged_at, weight, unit, notes")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load weight logs: ${error.message}`);
  }
  return data ?? [];
}
