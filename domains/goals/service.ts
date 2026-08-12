"use server";

import { goalsStepSchema, goalTargetSchema, type GoalTargetMetricType } from "@/domains/goals/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import { createClient } from "@/platform/supabase/server";
import { captureGoalBaseline } from "@/domains/goals/baseline";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export type GoalView = { id: string; outcome: string; targetDate: string | null; priority: number | null };

/** Active goals ordered by priority (1 = highest), matching
 * areta-mobile's lib/queries/goals.ts#getActiveGoals exactly — goals
 * with no priority set sort last rather than first (nullsFirst: false),
 * since an unranked goal shouldn't outrank an explicitly prioritized
 * one, and abandoned/completed goals are excluded via status='active'.
 * Dashboard's and Plan's own "top 3" slices predate this (they select
 * without a status filter and without nullsFirst) — this is the more
 * correct version, worth pointing new callers at. */
export async function getActiveGoals(userId: string, client?: SupabaseClient<Database>): Promise<GoalView[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("goals")
    .select("id, outcome, target_date, priority")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("priority", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load goals: ${error.message}`);
  }
  return (data ?? []).map((g) => ({ id: g.id, outcome: g.outcome, targetDate: g.target_date, priority: g.priority }));
}

/** Same active-goals list as `getActiveGoals`, widened with target/baseline
 * fields for the `/api/goals` list route (the mobile goal-target edit
 * flow's "pick which goal to edit" screen) — a separate function rather
 * than widening `getActiveGoals` itself, so its existing narrower
 * `GoalView` contract (and the one real caller depending on it,
 * `app/(app)/goals/page.tsx`) stays untouched. */
export async function getActiveGoalsWithTargets(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<GoalDetail[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("goals")
    .select(
      "id, outcome, target_date, priority, target_metric_type, target_value, target_direction, baseline_value, baseline_recorded_at"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("priority", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load goals: ${error.message}`);
  }
  return (data ?? []).map((g) => ({
    id: g.id,
    outcome: g.outcome,
    targetDate: g.target_date,
    priority: g.priority,
    targetMetricType: g.target_metric_type as GoalTargetMetricType | null,
    targetValue: g.target_value,
    targetDirection: g.target_direction as "increase" | "decrease" | null,
    baselineValue: g.baseline_value,
    baselineRecordedAt: g.baseline_recorded_at,
  }));
}

export async function saveGoalsStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = goalsStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "goals", parsed.data.goals, client);
  return { ok: true, data: undefined };
}

export type GoalDetail = GoalView & {
  targetMetricType: GoalTargetMetricType | null;
  targetValue: number | null;
  targetDirection: "increase" | "decrease" | null;
  baselineValue: number | null;
  baselineRecordedAt: string | null;
};

/** Single-goal lookup for the post-onboarding target edit form's prefill —
 * `getActiveGoals` above deliberately stays a lighter list-view projection
 * (matches areta-mobile's own query exactly), so this is a separate
 * function rather than widening that one's select list for every caller. */
export async function getGoalById(
  userId: string,
  goalId: string,
  client?: SupabaseClient<Database>
): Promise<GoalDetail | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("goals")
    .select(
      "id, outcome, target_date, priority, target_metric_type, target_value, target_direction, baseline_value, baseline_recorded_at"
    )
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load goal: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    outcome: data.outcome,
    targetDate: data.target_date,
    priority: data.priority,
    targetMetricType: data.target_metric_type as GoalTargetMetricType | null,
    targetValue: data.target_value,
    targetDirection: data.target_direction as "increase" | "decrease" | null,
    baselineValue: data.baseline_value,
    baselineRecordedAt: data.baseline_recorded_at,
  };
}

/**
 * Post-onboarding goal-target set/edit — the only place besides
 * onboarding's Goals step that can ever set a goal's numeric target
 * (domains/onboarding/write-output.ts is the other). Re-baselines
 * (domains/goals/baseline.ts#captureGoalBaseline) only when the metric
 * type is newly set or changes to a *different* metric — a same-metric
 * value tweak (e.g. a 180lb target adjusted to 175lb) keeps the original
 * baseline, since it's still valid history for that metric and
 * re-sampling "today" would just discard real trend history. Clearing the
 * target (all three fields null) clears the baseline too, so a stale
 * baseline never lingers for a metric the goal no longer tracks.
 */
export async function setGoalTarget(
  userId: string,
  goalId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = goalTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { targetMetricType, targetValue, targetDirection } = parsed.data;
  const supabase = client ?? (await createClient());

  const { data: existing, error: fetchError } = await supabase
    .from("goals")
    .select("target_metric_type")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!existing) return { ok: false, error: "Goal not found." };

  const metricTypeChanged = targetMetricType !== existing.target_metric_type;
  let baselineUpdate: { baseline_value: number | null; baseline_recorded_at: string | null } | Record<string, never> =
    {};
  if (targetMetricType === null) {
    baselineUpdate = { baseline_value: null, baseline_recorded_at: null };
  } else if (metricTypeChanged) {
    const baseline = await captureGoalBaseline(supabase, userId, targetMetricType);
    baselineUpdate = { baseline_value: baseline?.value ?? null, baseline_recorded_at: baseline?.recordedAt ?? null };
  }

  const { error } = await supabase
    .from("goals")
    .update({
      target_metric_type: targetMetricType,
      target_value: targetValue,
      target_direction: targetDirection,
      ...baselineUpdate,
    })
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
