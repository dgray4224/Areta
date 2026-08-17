import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/platform/env";
import type { Database } from "@/platform/db/types";
import type { MetricType } from "@/platform/health/metrics";
import { insertImportedWeightLog } from "@/domains/weight/service";
import { insertImportedSleepLog } from "@/domains/sleep/service";
import { insertImportedStepLog } from "@/domains/steps/service";
import { insertImportedHeartRateLog } from "@/domains/heartrate/service";
import { insertImportedWorkoutLog } from "@/domains/workout/service";
import { insertImportedVitalLog, insertImportedMindfulMinutesLog } from "@/domains/vitals/service";
import type { ActionResult } from "@/platform/auth/actions";
import { z } from "zod";
import { insertImportedHealthMetricsBatch } from "@/platform/health/metrics";
import { importedStepLogSchema } from "@/domains/steps/schema";
import { importedHeartRateLogSchema } from "@/domains/heartrate/schema";
import { importedWeightLogSchema } from "@/domains/weight/schema";
import { importedVitalSampleSchema } from "@/domains/vitals/schema";
import { recomputeActivityDailySummaryForDay, resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";

type Handler = (
  supabase: SupabaseClient<Database>,
  userId: string,
  entry: unknown
) => Promise<ActionResult<{ skipped: boolean }>>;

// One entry per metric_type health_metrics accepts (see platform/health/
// metrics.ts). Payload is keyed by metric type -- { weight: [...], sleep:
// [...], vo2_max: [...], ... } -- each array of entries shaped per that
// type's own Zod schema (domains/*/schema.ts). Dispatching through this
// registry (rather than 22 hand-written Promise.all blocks) is what
// consolidating storage into one health_metrics table actually buys here:
// adding metric type #23 later is a one-line registry entry, not a new
// payload key + new Promise.all block + new response field.
const HANDLERS: Record<MetricType, Handler> = {
  weight: insertImportedWeightLog,
  sleep: insertImportedSleepLog,
  steps: insertImportedStepLog,
  heart_rate: insertImportedHeartRateLog,
  workout: insertImportedWorkoutLog,
  vo2_max: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "vo2_max", entry),
  resting_heart_rate: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "resting_heart_rate", entry),
  heart_rate_variability: (supabase, userId, entry) =>
    insertImportedVitalLog(supabase, userId, "heart_rate_variability", entry),
  walking_heart_rate_avg: (supabase, userId, entry) =>
    insertImportedVitalLog(supabase, userId, "walking_heart_rate_avg", entry),
  active_energy: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "active_energy", entry),
  basal_energy: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "basal_energy", entry),
  distance_walking_running: (supabase, userId, entry) =>
    insertImportedVitalLog(supabase, userId, "distance_walking_running", entry),
  distance_cycling: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "distance_cycling", entry),
  body_fat_percentage: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "body_fat_percentage", entry),
  lean_body_mass: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "lean_body_mass", entry),
  body_mass_index: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "body_mass_index", entry),
  height: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "height", entry),
  flights_climbed: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "flights_climbed", entry),
  walking_speed: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "walking_speed", entry),
  walking_steadiness: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "walking_steadiness", entry),
  oxygen_saturation: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "oxygen_saturation", entry),
  respiratory_rate: (supabase, userId, entry) => insertImportedVitalLog(supabase, userId, "respiratory_rate", entry),
  mindful_minutes: insertImportedMindfulMinutesLog,
};

type HealthSyncPayload = Partial<Record<MetricType, unknown[]>>;

/**
 * Authenticated batch ingestion endpoint for imported health data
 * (CLAUDE.md §14 Apple Health Roadmap — the HealthKit companion app).
 * Authenticates via a Supabase access-token Bearer header rather than the
 * cookie-based session platform/supabase/server.ts uses — a native app has
 * no cookies to send. Reuses the same Supabase project's auth with the
 * caller's own access token (no service-role bypass), so RLS applies to
 * every write exactly as it does for the web app.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const supabase = createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let body: HealthSyncPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const response: Partial<Record<MetricType, ReturnType<typeof summarize>>> = {};

  // Days touched by this request, collected across every metric type and
  // recomputed ONCE at the end. Previously each imported step/heart-rate
  // sample triggered its own activity-daily-summary recompute -- several
  // queries apiece -- so a day holding 25 samples recomputed 25 times.
  // That, not the insert itself, was the bulk of a backfill's database
  // load.
  const touchedDays = new Set<string>();

  for (const [metricType, entries] of Object.entries(body) as [MetricType, unknown[] | undefined][]) {
    if (!entries) continue;

    // Quantity types (steps, heart rate, and every vitals type) share one
    // sample shape and are the overwhelming majority of any import, so
    // they go through the bulk path. Sleep and workouts keep their bespoke
    // per-sample handlers: different shapes, and low enough volume that
    // batching them would add risk for no measurable gain.
    const quantitySchema = QUANTITY_SCHEMAS[metricType];
    if (quantitySchema) {
      response[metricType] = await importQuantityBatch(
        supabase,
        user.id,
        metricType,
        entries,
        quantitySchema,
        touchedDays
      );
      continue;
    }

    const handler = HANDLERS[metricType];
    // Unrecognized keys are silently ignored rather than rejected -- lets a
    // newer mobile client send a metric type this deployment doesn't know
    // about yet without breaking the whole sync.
    if (!handler) continue;
    const results = await Promise.all(entries.map((entry) => handler(supabase, user.id, entry)));
    response[metricType] = summarize(results);
  }

  for (const day of touchedDays) {
    await recomputeActivityDailySummaryForDay(supabase, user.id, day);
  }

  return NextResponse.json(response);
}


/** Metric types whose imported payload is the uniform quantity envelope
 * {loggedAt, value, unit, source, device, dedupKey}. Steps keeps its own
 * schema because it requires an integer; the rest share the vitals one.
 * Absence from this map means "not batchable" and routes to HANDLERS. */
const QUANTITY_SCHEMAS: Partial<Record<MetricType, z.ZodType<ImportedQuantityInput>>> = {
  steps: importedStepLogSchema,
  heart_rate: importedHeartRateLogSchema,
  weight: importedWeightLogSchema,
  vo2_max: importedVitalSampleSchema,
  resting_heart_rate: importedVitalSampleSchema,
  heart_rate_variability: importedVitalSampleSchema,
  walking_heart_rate_avg: importedVitalSampleSchema,
  active_energy: importedVitalSampleSchema,
  basal_energy: importedVitalSampleSchema,
  distance_walking_running: importedVitalSampleSchema,
  distance_cycling: importedVitalSampleSchema,
  body_fat_percentage: importedVitalSampleSchema,
  lean_body_mass: importedVitalSampleSchema,
  body_mass_index: importedVitalSampleSchema,
  height: importedVitalSampleSchema,
  flights_climbed: importedVitalSampleSchema,
  walking_speed: importedVitalSampleSchema,
  walking_steadiness: importedVitalSampleSchema,
  oxygen_saturation: importedVitalSampleSchema,
  respiratory_rate: importedVitalSampleSchema,
};

type ImportedQuantityInput = {
  loggedAt: string;
  value: number;
  unit: string;
  source: string;
  device?: string;
  dedupKey: string;
};

/**
 * Validates a whole metric type's payload, writes it in one upsert, and
 * records which local days it touched so the caller can recompute each of
 * them once.
 *
 * Invalid samples are reported per-sample, exactly as before -- one bad
 * row in a page must not cost the other ninety-nine.
 */
async function importQuantityBatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  metricType: MetricType,
  entries: unknown[],
  schema: z.ZodType<ImportedQuantityInput>,
  touchedDays: Set<string>
) {
  const failed: string[] = [];
  const items: (ImportedQuantityInput & { startedAt: string })[] = [];

  for (const entry of entries) {
    const parsed = schema.safeParse(entry);
    if (!parsed.success) {
      failed.push(parsed.error.issues[0]?.message ?? "Invalid input");
      continue;
    }
    items.push({ ...parsed.data, startedAt: new Date(parsed.data.loggedAt).toISOString() });
  }

  if (items.length === 0) return { inserted: 0, skipped: 0, failed };

  const result = await insertImportedHealthMetricsBatch(
    supabase,
    userId,
    metricType,
    items.map((i) => ({
      startedAt: i.startedAt,
      value: i.value,
      unit: i.unit,
      source: i.source,
      device: i.device ?? null,
      dedupKey: i.dedupKey,
    }))
  );

  if (!result.ok) return { inserted: 0, skipped: 0, failed: [...failed, result.error] };

  // Only the types that actually feed activity_daily_summaries need a
  // recompute; the other vitals do not appear in it.
  if (SUMMARY_RELEVANT.has(metricType)) {
    const timezone = await resolveTimezone(supabase, userId);
    for (const item of items) touchedDays.add(localDateString(new Date(item.startedAt), timezone));
  }

  return { inserted: result.data.inserted, skipped: result.data.skipped, failed };
}

/** Metric types that activity_daily_summaries actually aggregates. */
const SUMMARY_RELEVANT = new Set<MetricType>(["steps", "heart_rate", "weight"]);

function summarize(results: ActionResult<{ skipped: boolean }>[]) {
  let inserted = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const result of results) {
    if (!result.ok) {
      failed.push(result.error);
    } else if (result.data.skipped) {
      skipped++;
    } else {
      inserted++;
    }
  }
  return { inserted, skipped, failed };
}
