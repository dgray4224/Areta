/**
 * One-time backfill of activity_daily_summaries for all existing history.
 * Data is bounded to <=3 years per user (see the health-import retention
 * migration, 0017), and only a handful of profiles exist today, so this
 * does a plain full-history pass per user rather than batching/cursoring --
 * correctness over optimization for this data volume.
 *
 * Reuses the exact same recompute functions the incremental write paths
 * call (recomputeActivityDailySummaryForDay), rather than a parallel
 * aggregation implementation, so the backfill is guaranteed to produce
 * identical rows to what incremental writes would have produced.
 *
 * Safe to re-run: recompute upserts on (user_id, day), so this is
 * idempotent.
 *
 * Invoke with: pnpm run backfill:activity-summary
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { localDateString } from "@/domains/activity-summary/timezone";
import { recomputeActivityDailySummaryForDay } from "@/domains/activity-summary/service";

const DEFAULT_TIMEZONE = "UTC";

async function main() {
  const supabase = createScriptAdminClient();

  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, time_zone");
  if (profilesError) throw profilesError;

  for (const profile of profiles ?? []) {
    const userId = profile.id;
    const timezone = profile.time_zone ?? DEFAULT_TIMEZONE;

    const [{ data: workoutLogs }, { data: weightLogs }, { data: stepLogs }, { data: sleepLogs }, { data: heartRateLogs }] =
      await Promise.all([
        supabase.from("workout_logs").select("start_date").eq("user_id", userId),
        supabase.from("weight_logs").select("logged_at").eq("user_id", userId),
        supabase.from("step_logs").select("logged_at").eq("user_id", userId),
        supabase.from("sleep_logs").select("date").eq("user_id", userId),
        supabase.from("heart_rate_logs").select("logged_at").eq("user_id", userId),
      ]);

    const days = new Set<string>();
    for (const row of workoutLogs ?? []) days.add(localDateString(new Date(row.start_date), timezone));
    for (const row of weightLogs ?? []) days.add(localDateString(new Date(row.logged_at), timezone));
    for (const row of stepLogs ?? []) days.add(localDateString(new Date(row.logged_at), timezone));
    for (const row of heartRateLogs ?? []) days.add(localDateString(new Date(row.logged_at), timezone));
    for (const row of sleepLogs ?? []) days.add(row.date);

    for (const day of days) {
      await recomputeActivityDailySummaryForDay(supabase, userId, day);
    }

    console.log(`[backfill-activity-daily-summaries] user ${userId}: ${days.size} day(s) backfilled`);
  }
}

main()
  .then(() => {
    console.log("[backfill-activity-daily-summaries] done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[backfill-activity-daily-summaries] failed", err);
    process.exit(1);
  });
