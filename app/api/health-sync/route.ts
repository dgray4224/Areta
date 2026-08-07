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
  for (const [metricType, entries] of Object.entries(body) as [MetricType, unknown[] | undefined][]) {
    const handler = HANDLERS[metricType];
    // Unrecognized keys are silently ignored rather than rejected -- lets a
    // newer mobile client send a metric type this deployment doesn't know
    // about yet without breaking the whole sync.
    if (!handler || !entries) continue;
    const results = await Promise.all(entries.map((entry) => handler(supabase, user.id, entry)));
    response[metricType] = summarize(results);
  }

  return NextResponse.json(response);
}

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
