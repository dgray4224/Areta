import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/platform/env";
import type { Database } from "@/platform/db/types";
import { insertImportedWeightLog } from "@/domains/weight/service";
import { insertImportedSleepLog } from "@/domains/sleep/service";
import { insertImportedStepLog } from "@/domains/steps/service";
import { insertImportedHeartRateLog } from "@/domains/heartrate/service";
import { insertImportedWorkoutLog } from "@/domains/workout/service";
import type { ActionResult } from "@/platform/auth/actions";

type HealthSyncPayload = {
  weight?: unknown[];
  sleep?: unknown[];
  steps?: unknown[];
  heartRate?: unknown[];
  workouts?: unknown[];
};

/**
 * Authenticated batch ingestion endpoint for imported health data
 * (CLAUDE.md §14 Apple Health Roadmap — Part 2 groundwork for a future
 * HealthKit companion app). Authenticates via a Supabase access-token
 * Bearer header rather than the cookie-based session platform/supabase/server.ts
 * uses — a native app has no cookies to send. Reuses the same Supabase
 * project's auth with the caller's own access token (no service-role
 * bypass), so RLS applies to every write exactly as it does for the web app.
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

  const weightResults = await Promise.all(
    (body.weight ?? []).map((entry) => insertImportedWeightLog(supabase, user.id, entry))
  );
  const sleepResults = await Promise.all(
    (body.sleep ?? []).map((entry) => insertImportedSleepLog(supabase, user.id, entry))
  );
  const stepsResults = await Promise.all(
    (body.steps ?? []).map((entry) => insertImportedStepLog(supabase, user.id, entry))
  );
  const heartRateResults = await Promise.all(
    (body.heartRate ?? []).map((entry) => insertImportedHeartRateLog(supabase, user.id, entry))
  );
  const workoutResults = await Promise.all(
    (body.workouts ?? []).map((entry) => insertImportedWorkoutLog(supabase, user.id, entry))
  );

  return NextResponse.json({
    weight: summarize(weightResults),
    sleep: summarize(sleepResults),
    steps: summarize(stepsResults),
    heartRate: summarize(heartRateResults),
    workouts: summarize(workoutResults),
  });
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
