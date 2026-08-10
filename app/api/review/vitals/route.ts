import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getVitalsTrend, DEFAULT_VITALS_METRICS, VALID_VITALS_METRICS } from "@/domains/review/vitals";
import type { MetricType } from "@/platform/health/metrics";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

/**
 * Bearer-authenticated vitals-trend read for the mobile Review tab's
 * Vitals sparklines. getVitalsTrend is shared with the web app's own
 * /review page (see domains/review/vitals.ts) so both compute the same
 * day-bucketed series the same way.
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
      ? (requestedMetrics.filter((m) => VALID_VITALS_METRICS.has(m)) as MetricType[])
      : DEFAULT_VITALS_METRICS;
  const days = Math.min(MAX_DAYS, Math.max(1, Number(params.get("days")) || DEFAULT_DAYS));

  if (metricTypes.length === 0) {
    return NextResponse.json({ error: "No valid metric types requested" }, { status: 400 });
  }

  const result = await getVitalsTrend(userId, metricTypes, days, supabase);
  return NextResponse.json(result);
}
