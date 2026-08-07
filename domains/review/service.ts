"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { computeWeeklyMetrics, type WeeklyMetrics } from "@/domains/review/metrics";
import { weeklyBriefSchema, type WeeklyBrief } from "@/domains/review/brief-schema";
import { buildWeeklyReviewContext } from "@/domains/review/context-builder";
import { getRecentMemories } from "@/domains/memory/service";
import { getAIProvider } from "@/platform/ai/get-provider";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import type { TaskStatus } from "@/domains/tasks/schema";
import { reviewWeekStart, todayIso } from "@/domains/review/dates";

const LB_PER_KG = 2.2046226218;

const WEEKLY_BRIEF_INSTRUCTIONS = `You are the weekly regeneration engine for Areta, a personal execution platform. Given a user's current phase, active goals, this week's deterministically-calculated metrics, durable memory Areta has learned about them over time, and (if any) last week's priorities, produce a WeeklyOperatingBrief.

Rules:
- Never invent medical advice or recovery progression. Do not suggest changes to brace settings, weight-bearing status, exercise intensity, running, jumping, return to sport, or medication — that is exclusively a clinician's call. A recovery-domain goal should usually get "insufficient_data" progress unless durable memory clearly describes clinician-approved progress.
- Classify each active goal's progress as "ahead", "on_track", "at_risk", or "insufficient_data" based on the metrics and the durable memory — never assume.
- If metrics.isDataSparse is true, most goals should likely be "insufficient_data" rather than a confident status, since there isn't enough logged data to trust yet.
- "changes" are proposed changes to operating parameters or the plan (e.g. field: "calorie_target", "meal_plan_variety", "task_load"), each with a reason grounded in the metrics/memory. Describe changes qualitatively — do not invent a specific new numeric target yourself; deterministic code recalculates exact numbers separately. previousValue/proposedValue can be short labels like "moderate" -> "lower" when a specific number isn't yet known.
- Distinguish adherence issues (plan was fine, user didn't follow it), plan-design issues (plan was unrealistic or unpleasant), outcome issues (followed the plan, but the result didn't happen), and data-quality issues (not enough reliable data) — never default to blaming the user's discipline when the metrics point elsewhere.
- Priorities: at most 3, ranked 1-3, each tied to a specific goal or domain.
- Be honest, not falsely encouraging. If adherence was poor, say so plainly and explain the likely cause using the classification above.
- Keep the executive summary to 2-4 sentences.
- weeklyMottoId: pick the id from motivationQuoteBank whose themes best match this user's real priorities or struggles this week. Never invent a quote or use one outside the provided bank — only return one of the given ids.`;

export type WeeklyReviewView = {
  id: string;
  weekStart: string;
  status: "draft" | "answered" | "generated" | "approved";
  metrics: WeeklyMetrics | null;
  brief: WeeklyBrief | null;
};

async function fetchMetrics(
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyMetrics> {
  const supabase = await createClient();
  const [
    { data: weightLogsRaw },
    { data: sleepLogs },
    { data: nutritionLogs },
    { data: recoveryLogs },
    { data: studySessions },
    { data: tasks },
    calorieTarget,
    proteinTarget,
  ] = await Promise.all([
    supabase
      .from("health_metrics")
      .select("started_at, value, unit")
      .eq("user_id", userId)
      .eq("metric_type", "weight")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("metric_type", "sleep")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("nutrition_logs")
      .select("date, calories, protein")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    supabase
      .from("recovery_logs")
      .select("date, pain, swelling")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("duration_minutes")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    supabase
      .from("daily_actions")
      .select("status, skip_reason")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    getApprovedParameterValue(userId, "nutrition", "calorie_target"),
    getApprovedParameterValue(userId, "nutrition", "protein_target_g"),
  ]);

  const weightLogs = (weightLogsRaw ?? []).map((w) => ({
    loggedAt: w.started_at,
    weight: w.unit === "kg" ? Number(w.value) * LB_PER_KG : Number(w.value),
  }));

  return computeWeeklyMetrics({
    weekStart,
    weightLogs,
    sleepLogs: (sleepLogs ?? []).map((s) => ({ totalDurationMinutes: s.value != null ? Number(s.value) : null })),
    nutritionLogs: (nutritionLogs ?? []).map((n) => ({
      date: n.date,
      calories: n.calories,
      protein: n.protein,
    })),
    recoveryLogs: (recoveryLogs ?? []).map((r) => ({
      date: r.date,
      pain: r.pain,
      swelling: r.swelling,
    })),
    studySessions: (studySessions ?? []).map((s) => ({ durationMinutes: s.duration_minutes })),
    tasks: (tasks ?? []).map((t) => ({
      status: t.status as TaskStatus,
      skipReason: t.skip_reason,
    })),
    calorieTarget,
    proteinTarget,
  });
}

export async function getOrCreateWeeklyReview(userId: string): Promise<WeeklyReviewView> {
  const weekStart = reviewWeekStart();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      weekStart: existing.week_start,
      status: existing.status as WeeklyReviewView["status"],
      metrics: existing.metrics as WeeklyMetrics,
      brief: existing.brief as WeeklyBrief | null,
    };
  }

  const metrics = await fetchMetrics(userId, weekStart, todayIso());
  const { data: created, error } = await supabase
    .from("weekly_reviews")
    .insert({ user_id: userId, week_start: weekStart, metrics, status: "draft" })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create weekly review: ${error?.message}`);
  }

  return {
    id: created.id,
    weekStart: created.week_start,
    status: created.status as WeeklyReviewView["status"],
    metrics,
    brief: null,
  };
}

export async function generateWeeklyBrief(userId: string): Promise<ActionResult> {
  const weekStart = reviewWeekStart();
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review) {
    return { ok: false, error: "Open the review page before generating a brief." };
  }

  const [
    { data: phases },
    { data: goals },
    { data: previousReview },
    recentMemories,
    expectedWeeklyRateLb,
    calorieTarget,
    proteinTarget,
  ] =
    await Promise.all([
      supabase.from("phases").select("name, mission").eq("user_id", userId).eq("is_current", true).limit(1),
      supabase
        .from("goals")
        .select("id, outcome, target_date, priority, domains(key)")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("weekly_reviews")
        .select("brief")
        .eq("user_id", userId)
        .lt("week_start", weekStart)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getRecentMemories(userId),
      getApprovedParameterValue(userId, "nutrition", "expected_weekly_rate_lb"),
      getApprovedParameterValue(userId, "nutrition", "calorie_target"),
      getApprovedParameterValue(userId, "nutrition", "protein_target_g"),
    ]);

  const previousBrief = previousReview?.brief as WeeklyBrief | null;

  const context = buildWeeklyReviewContext({
    weekStart,
    currentPhase:
      phases && phases.length > 0 ? { name: phases[0].name, mission: phases[0].mission } : null,
    activeGoals: (goals ?? []).map((g) => ({
      id: g.id,
      outcome: g.outcome,
      domain: (g.domains as unknown as { key: string } | null)?.key ?? "general",
      targetDate: g.target_date,
      priority: g.priority,
    })),
    metrics: review.metrics as WeeklyMetrics,
    nutritionTargets:
      calorieTarget || proteinTarget ? { calorieTarget, proteinTarget, expectedWeeklyRateLb } : null,
    recentMemories: recentMemories.map((m) => ({
      type: m.type,
      content: m.content,
      evidence: m.evidence,
    })),
    previousWeekPriorities: previousBrief?.priorities.map((p) => p.title) ?? [],
  });

  const provider = getAIProvider();
  const result = await provider.generateStructured({
    instructions: WEEKLY_BRIEF_INSTRUCTIONS,
    context: context as unknown as Record<string, unknown>,
    schema: weeklyBriefSchema,
  });

  await supabase.from("ai_runs").insert({
    user_id: userId,
    purpose: "weekly_brief",
    model: "claude-sonnet-5",
    success: result.ok,
    error: result.ok ? null : result.error,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const { error } = await supabase
    .from("weekly_reviews")
    .update({ brief: result.data, status: "generated" })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("recommendations").delete().eq("weekly_review_id", review.id);
  if (result.data.changes.length > 0) {
    await supabase.from("recommendations").insert(
      result.data.changes.map((c) => ({
        user_id: userId,
        weekly_review_id: review.id,
        field: c.field,
        previous_value: c.previousValue,
        proposed_value: c.proposedValue,
        reason: c.reason,
        confidence: c.confidence,
      }))
    );
  }

  return { ok: true, data: undefined };
}

export type RecommendationView = {
  id: string;
  field: string;
  previousValue: string | number | null;
  proposedValue: string | number | null;
  reason: string;
  confidence: number | null;
};

export async function getRecommendationsForCurrentReview(
  userId: string
): Promise<RecommendationView[]> {
  const weekStart = reviewWeekStart();
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review) return [];

  const { data, error } = await supabase
    .from("recommendations")
    .select("id, field, previous_value, proposed_value, reason, confidence")
    .eq("weekly_review_id", review.id);

  if (error) {
    throw new Error(`Failed to load recommendations: ${error.message}`);
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    field: r.field,
    previousValue: r.previous_value as string | number | null,
    proposedValue: r.proposed_value as string | number | null,
    reason: r.reason,
    confidence: r.confidence,
  }));
}
