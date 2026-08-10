import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import type { MetricType } from "@/platform/health/metrics";

const LB_PER_KG = 2.2046226218;
export const DEFAULT_VITALS_METRICS: MetricType[] = [
  "weight",
  "sleep",
  "steps",
  "resting_heart_rate",
  "heart_rate_variability",
];
const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

/** Whether same-day readings should be summed (cumulative quantities —
 * steps taken, minutes slept, distance covered) or averaged (point-in-time
 * levels — weight, heart rate, VO2 max). Missing entries default to
 * "average" below, the safer assumption for a level-type reading. */
const SUM_METRICS: ReadonlySet<MetricType> = new Set([
  "steps",
  "sleep",
  "active_energy",
  "basal_energy",
  "distance_walking_running",
  "distance_cycling",
  "flights_climbed",
  "mindful_minutes",
]);

export const VALID_VITALS_METRICS = new Set<string>([
  "weight",
  "sleep",
  "steps",
  "heart_rate",
  "workout",
  "vo2_max",
  "resting_heart_rate",
  "heart_rate_variability",
  "walking_heart_rate_avg",
  "active_energy",
  "basal_energy",
  "distance_walking_running",
  "distance_cycling",
  "body_fat_percentage",
  "lean_body_mass",
  "body_mass_index",
  "height",
  "flights_climbed",
  "walking_speed",
  "walking_steadiness",
  "oxygen_saturation",
  "respiratory_rate",
  "mindful_minutes",
]);

export type VitalsTrend = Record<string, { date: string; value: number }[]>;

/**
 * Day-bucketed (user's local calendar day) vitals series for the Review
 * tab's Vitals sub-tab — a generic multi-metric version of app/api/
 * exercise/history/route.ts's day-bucketing pattern, since that route is
 * workout-specific. Days with no reading are simply omitted from that
 * metric's series — never interpolated or fabricated (same
 * "deterministic, real numbers only" rule the review engine follows
 * elsewhere). Shared by the mobile bearer route
 * (app/api/review/vitals/route.ts) and the web app's own /review page.
 */
export async function getVitalsTrend(
  userId: string,
  metricTypes: MetricType[] = DEFAULT_VITALS_METRICS,
  days: number = DEFAULT_DAYS,
  client?: SupabaseClient<Database>
): Promise<VitalsTrend> {
  const supabase = client ?? (await createClient());
  const clampedDays = Math.min(MAX_DAYS, Math.max(1, days));

  const timezone = await resolveTimezone(supabase, userId);
  const windowStart = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("health_metrics")
    .select("metric_type, started_at, value, unit")
    .eq("user_id", userId)
    .in("metric_type", metricTypes)
    .gte("started_at", windowStart);

  if (error) {
    throw new Error(`Failed to load vitals trend: ${error.message}`);
  }

  // metric -> day -> readings, so multi-entry days can be aggregated
  // (summed or averaged) before being flattened into the response series.
  const byMetricByDay = new Map<MetricType, Map<string, number[]>>();
  for (const type of metricTypes) byMetricByDay.set(type, new Map());

  for (const row of rows ?? []) {
    const type = row.metric_type as MetricType;
    const byDay = byMetricByDay.get(type);
    if (!byDay || row.value === null) continue;
    const day = localDateString(new Date(row.started_at), timezone);
    const value = type === "weight" && row.unit === "kg" ? Number(row.value) * LB_PER_KG : Number(row.value);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(value);
  }

  const result: VitalsTrend = {};
  for (const type of metricTypes) {
    const byDay = byMetricByDay.get(type)!;
    const useSum = SUM_METRICS.has(type);
    const series = Array.from(byDay.entries())
      .map(([date, values]) => ({
        date,
        value: useSum
          ? Math.round(values.reduce((sum, v) => sum + v, 0) * 10) / 10
          : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    result[type] = series;
  }

  return result;
}
