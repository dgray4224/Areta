"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOlderThanHealthImportRetentionWindow } from "@/platform/health/retention";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

/** Every HealthKit-sourced (or manually entered) metric shares one table,
 * health_metrics, discriminated by metric_type. See the create_health_metrics
 * migration for the exact column shapes this maps onto — most types are a
 * single point-in-time value; workout/sleep/mindful_minutes use started_at/
 * ended_at as an interval; weight/sleep are the only two with a manual-entry
 * path (notes, sleep_quality, sleep_interruptions). */
export type MetricType =
  | "weight"
  | "sleep"
  | "steps"
  | "heart_rate"
  | "workout"
  | "vo2_max"
  | "resting_heart_rate"
  | "heart_rate_variability"
  | "walking_heart_rate_avg"
  | "active_energy"
  | "basal_energy"
  | "distance_walking_running"
  | "distance_cycling"
  | "body_fat_percentage"
  | "lean_body_mass"
  | "body_mass_index"
  | "height"
  | "flights_climbed"
  | "walking_speed"
  | "walking_steadiness"
  | "oxygen_saturation"
  | "respiratory_rate"
  | "mindful_minutes";

type HealthMetricFields = {
  value?: number | null;
  unit?: string | null;
  startedAt: string;
  endedAt?: string | null;
  activityType?: string | null;
  totalEnergyBurnedKcal?: number | null;
  totalDistanceMeters?: number | null;
  notes?: string | null;
  sleepQuality?: number | null;
  sleepInterruptions?: number | null;
};

function toRow(userId: string, metricType: MetricType, fields: HealthMetricFields) {
  return {
    user_id: userId,
    metric_type: metricType,
    value: fields.value ?? null,
    unit: fields.unit ?? null,
    started_at: fields.startedAt,
    ended_at: fields.endedAt ?? null,
    activity_type: fields.activityType ?? null,
    total_energy_burned_kcal: fields.totalEnergyBurnedKcal ?? null,
    total_distance_meters: fields.totalDistanceMeters ?? null,
    notes: fields.notes ?? null,
    sleep_quality: fields.sleepQuality ?? null,
    sleep_interruptions: fields.sleepInterruptions ?? null,
  };
}

/** Manual-entry insert (weight/sleep only, today) — plain insert, no
 * retention check (a user must always be able to log old data by hand, per
 * platform/health/retention.ts's own comment), no dedup/upsert since manual
 * rows have no dedup_key. Coexists alongside any HealthKit-imported reading
 * for the same day rather than replacing it — for a *correction* (the user
 * saying "this imported value is wrong"), use
 * upsertManualHealthMetricOverride below instead, which does replace and
 * protects against re-import. */
export async function insertManualHealthMetric(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType,
  fields: HealthMetricFields & { source?: string }
): Promise<ActionResult> {
  const { error } = await supabase.from("health_metrics").insert({
    ...toRow(userId, metricType, fields),
    source: fields.source ?? "manual",
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/**
 * A user-initiated correction for one metric/day (Phase 3 of the
 * enhancement roadmap, 2026-08-13) — collapses that whole day to this one
 * value and protects it from future re-import. Upserts on a synthetic
 * `manual-override-{day}` dedup_key so editing the same day again updates
 * the same row rather than accumulating duplicates, and sets
 * `user_override`/`override_day` so insertImportedHealthMetric's
 * day-level guard (below) blocks any HealthKit re-sync for that day going
 * forward. Deliberately day-granularity, not per-sample: a manual
 * correction is a statement about "what actually happened that day," and
 * HealthKit's own per-sample dedup_key has no way to express that (see the
 * README's originally-flagged "manual correction can be silently
 * overwritten" gap — the missing piece was always this write path, not
 * the read-side guard, which already existed and simply had nothing that
 * ever set user_override=true).
 */
export async function upsertManualHealthMetricOverride(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType,
  fields: { value: number; unit?: string | null; day: string }
): Promise<ActionResult> {
  const timezone = await resolveTimezone(supabase, userId);
  // Noon, not midnight — avoids the stored started_at itself drifting to
  // the adjacent calendar day under localDateString's own UTC round-trip
  // if this row is ever re-read that way elsewhere.
  const startedAt = new Date(`${fields.day}T12:00:00Z`).toISOString();

  const { error } = await supabase.from("health_metrics").upsert(
    {
      user_id: userId,
      metric_type: metricType,
      value: fields.value,
      unit: fields.unit ?? null,
      started_at: startedAt,
      source: "manual",
      user_override: true,
      override_day: fields.day,
      dedup_key: `manual-override-${fields.day}`,
    },
    { onConflict: "user_id,metric_type,dedup_key" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  // Sanity check, not load-bearing: confirms the day we stored under
  // round-trips through the same timezone the import guard will later
  // recompute it with, so a bug here fails loudly in logs instead of
  // silently letting a future re-import slip past the guard.
  if (localDateString(new Date(startedAt), timezone) !== fields.day) {
    console.warn(
      `[upsertManualHealthMetricOverride] Stored override_day "${fields.day}" doesn't round-trip through timezone "${timezone}" — the day-level import guard may not match this row later.`
    );
  }
  return { ok: true, data: undefined };
}

/** Import-path insert (every metric type) — the mechanical part shared by
 * every domain's insertImported*Log function: retention-window check,
 * skip-if-user-already-hand-corrected guard, upsert on the
 * (user_id, metric_type, dedup_key) partial unique index. Domain-specific
 * Zod validation and any side effect (e.g. workout's logScheduleEvent,
 * sleep/workout's day-vs-instant recompute) stay in each domain's own
 * service.ts — this only owns what was previously duplicated identically
 * five times. */
export async function insertImportedHealthMetric(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType,
  fields: HealthMetricFields & { source: string; device?: string | null; dedupKey: string }
): Promise<ActionResult<{ skipped: boolean }>> {
  if (isOlderThanHealthImportRetentionWindow(fields.startedAt)) {
    return { ok: true, data: { skipped: true } };
  }

  // Day-level override guard (Phase 3, 2026-08-13) — checked first and
  // separately from the per-dedup_key check below: a manual correction's
  // dedup_key ("manual-override-{day}") never matches an imported
  // sample's own dedup_key, so only a day-scoped lookup can catch this.
  // See upsertManualHealthMetricOverride's doc comment for why this is
  // day-granularity rather than per-sample.
  const timezone = await resolveTimezone(supabase, userId);
  const day = localDateString(new Date(fields.startedAt), timezone);
  const { data: dayOverride } = await supabase
    .from("health_metrics")
    .select("id")
    .eq("user_id", userId)
    .eq("metric_type", metricType)
    .eq("override_day", day)
    .eq("user_override", true)
    .maybeSingle();
  if (dayOverride) {
    return { ok: true, data: { skipped: true } };
  }

  const { data: existing } = await supabase
    .from("health_metrics")
    .select("user_override")
    .eq("user_id", userId)
    .eq("metric_type", metricType)
    .eq("dedup_key", fields.dedupKey)
    .maybeSingle();

  if (existing?.user_override) {
    return { ok: true, data: { skipped: true } };
  }

  const { error } = await supabase.from("health_metrics").upsert(
    {
      ...toRow(userId, metricType, fields),
      source: fields.source,
      device: fields.device ?? null,
      imported_at: new Date().toISOString(),
      dedup_key: fields.dedupKey,
    },
    { onConflict: "user_id,metric_type,dedup_key" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { skipped: false } };
}
