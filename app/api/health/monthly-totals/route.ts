import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { resolveTimezone } from "@/domains/activity-summary/service";

/**
 * What we have stored, per metric type, per month — the server half of the
 * import reconciliation (2026-08-26).
 *
 * The device can ask HealthKit for the same aggregates without walking a
 * single sample, so comparing the two answers "is anything missing" in one
 * round trip instead of re-importing years to find out. Until this
 * existed, a finished import was only ever self-certified: the backfill
 * walked until its own pagination said stop and wrote a "done" flag, and
 * nothing ever checked that flag against reality.
 *
 * Read-only, and deliberately returns aggregates rather than rows — the
 * point is to make the check cheap enough to run routinely.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  // Months must be bucketed the way the phone buckets them. HealthKit's
  // statistics collection is anchored on local midnight, so comparing
  // against UTC months would disagree at every boundary and report a
  // mismatch on data that is completely intact.
  const timezone = await resolveTimezone(supabase, userId);

  const { data, error } = await supabase.rpc("health_monthly_totals", {
    p_user_id: userId,
    p_timezone: timezone,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    timezone,
    months: (data ?? []).map((row) => ({
      metricType: row.metric_type,
      month: row.month,
      sampleCount: Number(row.sample_count),
      total: row.total === null ? null : Number(row.total),
      average: row.average === null ? null : Number(row.average),
      minimum: row.minimum === null ? null : Number(row.minimum),
      maximum: row.maximum === null ? null : Number(row.maximum),
    })),
  });
}
