import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import type { MetricType } from "@/platform/health/metrics";

const LB_PER_KG = 2.2046226218;
const DEFAULT_METRICS: MetricType[] = ["weight", "sleep", "steps", "resting_heart_rate", "heart_rate_variability"];
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

const VALID_METRICS = new Set<string>([
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

/**
 * Bearer-authenticated vitals-trend read for the mobile Review tab's
 * Vitals sparklines — a generic multi-metric version of app/api/exercise/
 * history/route.ts's day-bucketing pattern (same local-calendar-day
 * approach), since that route is workout-specific. Days with no reading
 * are simply omitted from that metric's series — never interpolated or
 * fabricated (same "deterministic, real numbers only" rule the review
 * engine follows elsewhere).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const params = request.nextUrl.searchParams;
  const requestedMetrics = params.get("metrics")?.split(",").map((m) => m.trim()).filter(Boolean);
  const metricTypes: MetricType[] =
    requestedMetrics && requestedMetrics.length > 0
      ? (requestedMetrics.filter((m) => VALID_METRICS.has(m)) as MetricType[])
      : DEFAULT_METRICS;
  const days = Math.min(MAX_DAYS, Math.max(1, Number(params.get("days")) || DEFAULT_DAYS));

  if (metricTypes.length === 0) {
    return NextResponse.json({ error: "No valid metric types requested" }, { status: 400 });
  }

  const timezone = await resolveTimezone(supabase, userId);
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("health_metrics")
    .select("metric_type, started_at, value, unit")
    .eq("user_id", userId)
    .in("metric_type", metricTypes)
    .gte("started_at", windowStart);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const result: Record<string, { date: string; value: number }[]> = {};
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

  return NextResponse.json(result);
}
