"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOlderThanHealthImportRetentionWindow } from "@/platform/health/retention";
import { resolveTimezone, recomputeActivityDailySummaryForInstant } from "@/domains/activity-summary/service";
import { localDateString, localDayUtcRange } from "@/domains/activity-summary/timezone";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

// activity_daily_summaries only actually tracks these four metric types
// (weight_first/last, sleep_duration, steps_total, heart_rate_avg_bpm) --
// recomputing it for e.g. a VO2 max correction would be a guaranteed
// no-op, so upsertManualHealthMetricOverride only pays for the recompute
// when it can matter.
const ACTIVITY_SUMMARY_METRIC_TYPES = new Set<MetricType>(["weight", "sleep", "steps", "heart_rate"]);

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
 * value and protects it from future re-import. Deletes every existing row
 * for that user/metric/day (whatever HealthKit already imported, plus any
 * earlier override) before inserting the new one, so nothing downstream
 * ever averages or lists the pre-correction value alongside the
 * correction — a correction is a replacement, not an addition. Sets
 * `user_override`/`override_day` on the inserted row so
 * insertImportedHealthMetric's day-level guard (below) blocks any
 * HealthKit re-sync for that day going forward. Deliberately
 * day-granularity, not per-sample: a manual correction is a statement
 * about "what actually happened that day," and HealthKit's own
 * per-sample dedup_key has no way to express that (see the README's
 * originally-flagged "manual correction can be silently overwritten" gap
 * — the missing piece was always this write path, not the read-side
 * guard, which already existed and simply had nothing that ever set
 * user_override=true).
 */
export async function upsertManualHealthMetricOverride(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType,
  fields: { value: number; unit?: string | null; day: string }
): Promise<ActionResult> {
  const timezone = await resolveTimezone(supabase, userId);
  // start is local midnight for `day` in the user's own timezone, so
  // localDateString(start, timezone) === day always holds by
  // construction — unlike a fixed "noon UTC" guess, there's no longitude
  // where this can drift to the adjacent calendar day. [start, end)
  // doubles as the delete range below.
  const { start, end } = localDayUtcRange(fields.day, timezone);
  const startedAt = start.toISOString();

  const { error: deleteError } = await supabase
    .from("health_metrics")
    .delete()
    .eq("user_id", userId)
    .eq("metric_type", metricType)
    .gte("started_at", startedAt)
    .lt("started_at", end.toISOString());
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const { error } = await supabase.from("health_metrics").insert({
    user_id: userId,
    metric_type: metricType,
    value: fields.value,
    unit: fields.unit ?? null,
    started_at: startedAt,
    source: "manual",
    user_override: true,
    override_day: fields.day,
    dedup_key: `manual-override-${fields.day}`,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  if (ACTIVITY_SUMMARY_METRIC_TYPES.has(metricType)) {
    await recomputeActivityDailySummaryForInstant(supabase, userId, start);
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
/**
 * Whether this user has ANY manual override for this metric type.
 *
 * Both guards inside insertImportedHealthMetric exist only to stop an
 * import clobbering a hand-corrected value. When a user has never
 * corrected anything for this metric -- the overwhelming majority -- both
 * are provably no-ops, and skipping them takes the cost of an imported
 * sample from three queries to one.
 *
 * That matters at import scale rather than at steady state. A historical
 * backfill posts tens of thousands of samples, and a sample that simply
 * dedupes was still paying full price for two SELECTs that could not
 * change the outcome. Real consequence, observed 2026-08-17: a device
 * backfill depleted the project's Supabase Disk IO budget.
 *
 * Cached per (client, user, metric type). The client is per request, so
 * the cache lives exactly as long as one import batch -- long enough to
 * pay for itself, short enough that an override created mid-flight is
 * picked up by the very next request.
 */
const overridePresenceCache = new WeakMap<SupabaseClient<Database>, Map<string, Promise<boolean>>>();

async function userHasManualOverrides(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType
): Promise<boolean> {
  let perClient = overridePresenceCache.get(supabase);
  if (!perClient) {
    perClient = new Map();
    overridePresenceCache.set(supabase, perClient);
  }
  const key = `${userId}:${metricType}`;
  let cached = perClient.get(key);
  if (!cached) {
    cached = Promise.resolve(
      supabase
        .from("health_metrics")
        .select("id")
        .eq("user_id", userId)
        .eq("metric_type", metricType)
        .eq("user_override", true)
        .limit(1)
        .then(({ data }) => (data?.length ?? 0) > 0)
    );
    perClient.set(key, cached);
  }
  return cached;
}

/**
 * Bulk variant of insertImportedHealthMetric for one metric type.
 *
 * Same rules, one round trip. The per-sample function costs a query per
 * sample even when the sample merely dedupes; a historical backfill posts
 * tens of thousands, which is what depleted this project's Supabase Disk
 * IO budget on 2026-08-17. Here the override lookups happen once for the
 * whole batch and the writes collapse into a single upsert.
 *
 * Deliberately does NOT recompute activity daily summaries — the caller
 * does that once per distinct DAY. Doing it per sample was the larger
 * half of the same problem: a day holding 25 step samples recomputed that
 * day 25 times, at several queries each.
 */
export async function insertImportedHealthMetricsBatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType,
  items: (HealthMetricFields & { source: string; device?: string | null; dedupKey: string })[]
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const inWindow = items.filter((i) => !isOlderThanHealthImportRetentionWindow(i.startedAt));
  let admissible = inWindow;
  let skipped = items.length - inWindow.length;

  // Both override guards, batched. Skipped entirely for users with no
  // manual corrections, exactly as the per-sample path does.
  if (inWindow.length > 0 && (await userHasManualOverrides(supabase, userId, metricType))) {
    const timezone = await resolveTimezone(supabase, userId);

    const { data: overrideRows } = await supabase
      .from("health_metrics")
      .select("override_day")
      .eq("user_id", userId)
      .eq("metric_type", metricType)
      .eq("user_override", true);
    const overrideDays = new Set((overrideRows ?? []).map((r) => r.override_day).filter(Boolean) as string[]);

    const { data: overriddenRows } = await supabase
      .from("health_metrics")
      .select("dedup_key")
      .eq("user_id", userId)
      .eq("metric_type", metricType)
      .eq("user_override", true)
      .in(
        "dedup_key",
        inWindow.map((i) => i.dedupKey)
      );
    const overriddenKeys = new Set((overriddenRows ?? []).map((r) => r.dedup_key));

    admissible = inWindow.filter(
      (i) =>
        !overrideDays.has(localDateString(new Date(i.startedAt), timezone)) && !overriddenKeys.has(i.dedupKey)
    );
    skipped += inWindow.length - admissible.length;
  }

  if (admissible.length === 0) return { ok: true, data: { inserted: 0, skipped } };

  // Collapse duplicate dedup_keys WITHIN the batch. Postgres rejects an
  // ON CONFLICT DO UPDATE that would touch the same row twice in one
  // statement ("cannot affect row a second time"), and HealthKit can hand
  // back the same uuid across page boundaries, so this is reachable in
  // practice rather than theoretical. Last occurrence wins, matching the
  // per-sample path's sequential upserts.
  const byKey = new Map<string, (typeof admissible)[number]>();
  for (const item of admissible) byKey.set(item.dedupKey, item);
  const deduped = [...byKey.values()];
  skipped += admissible.length - deduped.length;

  const importedAt = new Date().toISOString();
  const { error } = await supabase.from("health_metrics").upsert(
    deduped.map((i) => ({
      ...toRow(userId, metricType, i),
      source: i.source,
      device: i.device ?? null,
      imported_at: importedAt,
      dedup_key: i.dedupKey,
    })),
    { onConflict: "user_id,metric_type,dedup_key" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { inserted: deduped.length, skipped } };
}

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
  // Skipped wholesale when this user has no overrides for this metric --
  // see userHasManualOverrides. Semantics are unchanged when they do.
  if (await userHasManualOverrides(supabase, userId, metricType)) {
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
