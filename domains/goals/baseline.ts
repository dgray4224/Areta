import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { GoalTargetMetricType } from "@/domains/goals/schema";
import { METRIC_FIELD } from "@/domains/review/trajectory";
import type { WeeklyMetrics } from "@/domains/review/metrics";

// Mirrors domains/review/vitals.ts's own LB_PER_KG constant -- not shared
// across files since it's a one-line physical-conversion primitive, not
// business logic that could drift.
const LB_PER_KG = 2.2046226218;

export type GoalBaseline = { value: number; recordedAt: string };

/**
 * Samples the nearest existing real data point for a newly-set goal
 * target, so a brand-new trajectory doesn't have to wait ~3 weekly-review
 * cycles before showing anything (domains/review/trajectory.ts's
 * MIN_DATA_POINTS = 3 counts this baseline as one of the three points).
 * Called both from onboarding's goal-creation (domains/onboarding/
 * write-output.ts) and the post-onboarding goal-target edit flow
 * (domains/goals/service.ts#setGoalTarget) -- one shared sampling
 * strategy so the two entry points can never disagree about what counts
 * as "the baseline."
 *
 * Never throws, and returns null (never blocking goal creation/editing)
 * when there's nothing to sample yet -- trajectory.ts already handles a
 * goal with no baseline gracefully (falls back to the first available
 * weekly_reviews history point), so a null baseline here is just "no
 * earlier start" rather than an error.
 */
export async function captureGoalBaseline(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetMetricType: GoalTargetMetricType
): Promise<GoalBaseline | null> {
  if (targetMetricType === "weight_lb") {
    const { data } = await supabase
      .from("health_metrics")
      .select("value, unit, started_at")
      .eq("user_id", userId)
      .eq("metric_type", "weight")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || data.value === null) return null;
    const value = data.unit === "kg" ? Number(data.value) * LB_PER_KG : Number(data.value);
    return { value: Math.round(value * 10) / 10, recordedAt: data.started_at.slice(0, 10) };
  }

  // The other four metric types (calorie/protein adherence, task
  // completion, learning minutes) only exist as weekly aggregates --
  // sample the most recent weekly_reviews row's already-computed metrics
  // rather than trying to recompute a partial week from raw logs.
  const field = METRIC_FIELD[targetMetricType];
  const { data: reviewRow } = await supabase
    .from("weekly_reviews")
    .select("week_start, metrics")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reviewRow) return null;

  const metrics = reviewRow.metrics as WeeklyMetrics;
  const value = metrics[field];
  if (typeof value !== "number") return null;
  return { value, recordedAt: reviewRow.week_start };
}
