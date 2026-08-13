import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { localDateString, localDayUtcRange } from "@/domains/activity-summary/timezone";
import { aggregateActivityDailySummary } from "@/domains/activity-summary/aggregate";

// Not a Server Action file -- only ever called from other server code
// (insertImported*Log / logWeight / logSleep), never invoked directly by a
// client form. Matches domains/review/metrics.ts's / domains/sleep/
// duration.ts's precedent of plain, non-Server-Action modules.

const DEFAULT_TIMEZONE = "UTC";

// Per-client memoization (2026-08-13, found via code review of
// insertImportedHealthMetric's new day-level override guard): a
// HealthKit sync batch calls resolveTimezone once per sample via
// Promise.all in app/api/health-sync/route.ts, re-querying the same
// user's profiles.time_zone hundreds of times for one request. Keyed by
// the supabase client instance (WeakMap, so it's GC'd with the request)
// rather than a module-level cache -- safe *only* because every caller
// in this codebase creates a fresh client per request/invocation
// (createClient()/createAdminClient() called inside each route handler,
// never a long-lived singleton reused across unrelated requests). The
// promise itself is cached, not just its result, so concurrent calls
// for the same user within one Promise.all also collapse into a single
// query rather than each firing before the first resolves.
const timezoneCache = new WeakMap<SupabaseClient<Database>, Map<string, Promise<string>>>();

export async function resolveTimezone(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  let perClient = timezoneCache.get(supabase);
  if (!perClient) {
    perClient = new Map();
    timezoneCache.set(supabase, perClient);
  }
  let cached = perClient.get(userId);
  if (!cached) {
    // Promise.resolve(...) -- Supabase's query builder is thenable but
    // not a real Promise instance (no .catch/.finally), which the Map's
    // Promise<string> value type requires.
    cached = Promise.resolve(
      supabase
        .from("profiles")
        .select("time_zone")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => data?.time_zone ?? DEFAULT_TIMEZONE)
    );
    perClient.set(userId, cached);
  }
  return cached;
}

/** This user's current local calendar day (YYYY-MM-DD), per
 * `profiles.time_zone` -- the timezone-aware replacement for the
 * `new Date().toISOString().slice(0, 10)` pattern copy-pasted across
 * mealplan/workoutplan/grocery/prep service.ts and app/api/plan/route.ts
 * (all UTC, silently wrong for any user not in UTC -- e.g. showing
 * tomorrow's date as "today" for the back half of the day in a negative
 * UTC offset). Not just for the Plan tab's "today" cell -- also feeds
 * dates written to nutrition_logs/schedule_events on completion, where a
 * wrong calendar day corrupts real user data, not just a display label. */
export async function todayForUser(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const timezone = await resolveTimezone(supabase, userId);
  return localDateString(new Date(), timezone);
}

async function recomputeForDayAndTimezone(
  supabase: SupabaseClient<Database>,
  userId: string,
  day: string,
  timezone: string
): Promise<void> {
  const { start, end } = localDayUtcRange(day, timezone);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // All five now query health_metrics filtered by metric_type instead of
  // five separate tables. Sleep previously bucketed by an equality match on
  // sleep_logs.date (a UTC-derived calendar date set by the mobile client);
  // health_metrics has no separate date column for sleep, so it now uses
  // the same timezone-aware started_at range as the other four types --
  // more consistent than the prior UTC-slice/local-range split, and sleep's
  // duration/quality (the only fields aggregate.ts reads) don't depend on
  // exactly which bucketing scheme selected the row.
  const [{ data: workoutRows }, { data: weightRows }, { data: stepRows }, { data: sleepRows }, { data: heartRateRows }] =
    await Promise.all([
      supabase
        .from("health_metrics")
        .select("started_at, ended_at, activity_type")
        .eq("user_id", userId)
        .eq("metric_type", "workout")
        .gte("started_at", startIso)
        .lt("started_at", endIso),
      supabase
        .from("health_metrics")
        .select("started_at, value, unit")
        .eq("user_id", userId)
        .eq("metric_type", "weight")
        .gte("started_at", startIso)
        .lt("started_at", endIso),
      supabase
        .from("health_metrics")
        .select("started_at, value")
        .eq("user_id", userId)
        .eq("metric_type", "steps")
        .gte("started_at", startIso)
        .lt("started_at", endIso),
      supabase
        .from("health_metrics")
        .select("value, sleep_quality")
        .eq("user_id", userId)
        .eq("metric_type", "sleep")
        .gte("started_at", startIso)
        .lt("started_at", endIso),
      supabase
        .from("health_metrics")
        .select("value")
        .eq("user_id", userId)
        .eq("metric_type", "heart_rate")
        .gte("started_at", startIso)
        .lt("started_at", endIso),
    ]);

  const summary = aggregateActivityDailySummary({
    userId,
    day,
    timezone,
    workoutLogs: (workoutRows ?? []).map((r) => ({
      start_date: r.started_at,
      duration_minutes: r.ended_at
        ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)
        : 0,
      activity_type: r.activity_type ?? "",
    })),
    // unit is a plain `text` column DB-side (CHECK-constrained to
    // 'lb'|'kg', not a Postgres enum), so the generated type widens it to
    // `string` -- the cast reflects a constraint the DB already enforces.
    weightLogs: (weightRows ?? []).map((r) => ({
      logged_at: r.started_at,
      weight: Number(r.value),
      unit: r.unit as "lb" | "kg",
    })),
    stepLogs: (stepRows ?? []).map((r) => ({ logged_at: r.started_at, count: Number(r.value) })),
    sleepLogs: (sleepRows ?? []).map((r) => ({
      total_duration_minutes: r.value != null ? Number(r.value) : null,
      quality: r.sleep_quality,
    })),
    heartRateLogs: (heartRateRows ?? []).map((r) => ({ bpm: Number(r.value) })),
  });

  const { error } = await supabase.from("activity_daily_summaries").upsert(summary, { onConflict: "user_id,day" });

  if (error) {
    console.error("[activity-summary] upsert failed", { userId, day, error });
  }
}

/**
 * Recomputes and upserts the activity_daily_summaries row for whichever
 * local day `instant` falls on, for the four timestamptz-based domains
 * (weight, steps, heart rate, workout). Never throws -- a recompute failure
 * must not surface as a failure of the primary log write that triggered it,
 * which has already succeeded by the time this runs.
 */
export async function recomputeActivityDailySummaryForInstant(
  supabase: SupabaseClient<Database>,
  userId: string,
  instant: Date
): Promise<void> {
  try {
    const timezone = await resolveTimezone(supabase, userId);
    const day = localDateString(instant, timezone);
    await recomputeForDayAndTimezone(supabase, userId, day, timezone);
  } catch (err) {
    console.error("[activity-summary] recompute (instant) failed", { userId, err });
  }
}

/**
 * Same as recomputeActivityDailySummaryForInstant, but for sleep entries --
 * skips the instant-to-local-day derivation and recomputes directly for the
 * given day (sleep's manual-entry form collects a plain date, not an
 * instant).
 */
export async function recomputeActivityDailySummaryForDay(
  supabase: SupabaseClient<Database>,
  userId: string,
  day: string
): Promise<void> {
  try {
    const timezone = await resolveTimezone(supabase, userId);
    await recomputeForDayAndTimezone(supabase, userId, day, timezone);
  } catch (err) {
    console.error("[activity-summary] recompute (day) failed", { userId, err });
  }
}
