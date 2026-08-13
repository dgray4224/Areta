import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { upsertManualHealthMetricOverride, type MetricType } from "@/platform/health/metrics";

// Every MetricType except "workout" -- a workout is a session record, not
// a point value, so "override today's workout to be X" doesn't mean
// anything. Mirrors the same exclusion Trends.tsx's SECONDARY_VITALS_METRIC_KEYS
// makes on the mobile side for the same reason.
const OVERRIDABLE_METRIC_TYPES = new Set<string>([
  "weight",
  "sleep",
  "steps",
  "heart_rate",
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
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bearer-authenticated manual correction for one metric/day (Phase 3 of
 * the enhancement roadmap, 2026-08-13) — mobile's Trends screen is the
 * first (only, as of this route) caller. See
 * upsertManualHealthMetricOverride's doc comment for the day-granularity
 * "collapse to one true value" model this implements, and why it's a
 * distinct action from the existing logWeight manual-log flow (which
 * stays untouched — logging an additional reading and correcting an
 * existing one are different user intents).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { metricType?: unknown; day?: unknown; value?: unknown; unit?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { metricType, day, value, unit } = body;
  if (typeof metricType !== "string" || !OVERRIDABLE_METRIC_TYPES.has(metricType)) {
    return NextResponse.json({ error: "Invalid or unsupported metricType" }, { status: 400 });
  }
  if (typeof day !== "string" || !DAY_PATTERN.test(day)) {
    return NextResponse.json({ error: "day must be YYYY-MM-DD" }, { status: 400 });
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return NextResponse.json({ error: "value must be a finite number" }, { status: 400 });
  }
  if (unit !== undefined && unit !== null && typeof unit !== "string") {
    return NextResponse.json({ error: "unit must be a string" }, { status: 400 });
  }

  const result = await upsertManualHealthMetricOverride(supabase, userId, metricType as MetricType, {
    value,
    unit: (unit as string | null | undefined) ?? null,
    day,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
