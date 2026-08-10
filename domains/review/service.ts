"use server";

import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { computeWeeklyMetrics, type WeeklyMetrics } from "@/domains/review/metrics";
import { weeklyBriefSchema, type WeeklyBrief } from "@/domains/review/brief-schema";
import { buildWeeklyReviewContext } from "@/domains/review/context-builder";
import { getRecentMemories, createMemory } from "@/domains/memory/service";
import type { MemoryType } from "@/domains/memory/schema";
import { getAIProvider } from "@/platform/ai/get-provider";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import type { TaskStatus } from "@/domains/tasks/schema";
import { reviewWeekStart, todayIso } from "@/domains/review/dates";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { computeMetricCorrelations } from "@/domains/review/correlations";
import { computeAchievements, type AchievementFacts } from "@/domains/review/achievements";
import { computeGoalTrajectories, type GoalTrajectory, type GoalWithTarget } from "@/domains/review/trajectory";
import { computeStreaks, type StreakFacts } from "@/domains/review/streaks";
import {
  evaluateExperimentOutcomes,
  type ExperimentOutcome,
  type EvaluableRecommendation,
  type ExpectedMetricKey,
  type ExpectedDirection,
} from "@/domains/review/experiments";

const LB_PER_KG = 2.2046226218;

/** How many past weeks' metrics to pull for correlation mining / achievement
 * ranking / goal-trajectory history. ~3 months — enough to find a real
 * pattern without the query growing unbounded for long-tenured users. */
const METRICS_HISTORY_WEEKS = 12;

/** Keys the mobile lightweight interview step (lib/review-screens/
 * InterviewStep.tsx) sends, mapped to the durable-memory type they get
 * promoted as (CLAUDE.md §7 Layer 4) when a brief is generated. Answers
 * with no mapping (an unrecognized key) are ignored rather than guessed
 * at — keep this in sync with the mobile question set. */
const ANSWER_MEMORY_TYPE: Record<string, MemoryType> = {
  wentWell: "successful_strategy",
  difficult: "failed_strategy",
  shouldChange: "preference",
  missedTaskCause: "constraint",
  scheduleChanges: "constraint",
};

const WEEKLY_BRIEF_INSTRUCTIONS = `You are the weekly regeneration engine for Areta, a personal execution platform that
uniquely spans nutrition, exercise, sleep, recovery, learning, tasks, and goals in one
place — most competitor apps track a single domain. Your job is to make that breadth
worth something: find the ONE most eye-opening, actionable thing in this week's data
and lead with it, then explain the rest. You never calculate anything — every number
in the context below (metrics, correlationFindings, achievements, goalTrajectories,
streaks, experimentOutcomes) was computed by deterministic code and is ground truth.
Restate these numbers exactly; never recompute, round differently, or invent a number
that isn't present in the context.

Rules:
- headlineInsight: the single most eye-opening, specific finding this week, in one
  punchy sentence a reader could not get from a single-domain app — usually built from
  correlationFindings (if a strong one exists, |r| >= 0.5, prefer it), achievements
  (a personal best or a broken streak), or a goalTrajectory that materially changed.
  If none of those produced anything meaningful, fall back to the most notable metric
  change. Never leave this generic ("good week") — it must reference a specific
  number from the context.
- executiveSummary: 2-4 sentences, distinct from headlineInsight — the broader picture,
  not a repeat of the headline.
- correlationNarrative: if correlationFindings is non-empty, explain the strongest one
  in plain language (e.g. "weeks you sleep more, you tend to complete more tasks") —
  state it as an observed pattern in this user's own data, never as medical/causal fact,
  and never claim causation the correlation coefficient doesn't support. If
  correlationFindings is empty, omit or say plainly there isn't enough data yet for a
  cross-domain pattern.
- achievementNote: reference achievements only if isPersonalBestAdherenceWeek is true,
  a streak is notable, or biggestWeekOverWeekJump is a real improvement — never invent
  praise; if nothing stands out, omit this rather than manufacturing enthusiasm. Never
  compare the user to anyone but their own history.
- For each active goal with a goalTrajectory whose paceStatus isn't "not_applicable" or
  "insufficient_data", weave the pace (ahead/on_pace/behind) into that goal's progress
  entry's summary, using the exact weeksNeededAtCurrentRate/weeksRemaining figures given
  — do not editorialize a different pace than the computed paceStatus says.
- experimentOutcomes: for each entry, narrate whether last week's change appears to have
  worked, using the given before/after values and classification (helpful/neutral/
  harmful/unknown) verbatim — never re-classify it yourself. Weave into whatWorked (if
  helpful) or whatNeedsImprovement (if harmful) rather than as disconnected trivia.
- interviewAnswers, if present, are the user's own words this week — use them to explain
  *why* something happened, not just *that* it happened, and to ground priorities/changes
  in what the user actually said mattered.
- Never invent medical advice or recovery progression. Do not suggest changes to brace
  settings, weight-bearing status, exercise intensity, running, jumping, return to sport,
  or medication — that is exclusively a clinician's call. A recovery-domain goal should
  usually get "insufficient_data" progress unless durable memory clearly describes
  clinician-approved progress.
- Classify each active goal's progress as "ahead", "on_track", "at_risk", or
  "insufficient_data" based on the metrics and durable memory — never assume. If
  metrics.isDataSparse is true, most goals should likely be "insufficient_data".
- "changes" are proposed changes to operating parameters or the plan, each grounded in
  metrics/memory/experimentOutcomes. Describe changes qualitatively — deterministic code
  recalculates exact numeric targets separately. For each change, also state
  expectedMetric (one of: weightChangeLb, averageWeightThisWeek, proteinAdherencePercent,
  calorieAdherencePercent, averageSleepMinutes, taskCompletionPercent, learningMinutes,
  averagePainThisWeek, averageSwellingThisWeek) and expectedDirection — this turns the
  change into a falsifiable one-week hypothesis that next week's brief will check against
  the real measured outcome. Pick the metric this change is actually meant to move, not
  an arbitrary one.
- Distinguish adherence issues, plan-design issues, outcome issues, and data-quality
  issues — never default to blaming the user's discipline when metrics point elsewhere.
- Priorities: at most 3, ranked 1-3, each tied to a specific goal or domain.
- Be honest, not falsely encouraging. If adherence was poor, say so plainly and explain
  the likely cause using the classification above.
- weeklyMottoId: pick from motivationQuoteBank whose themes best match this user's real
  priorities or struggles this week. Never invent a quote or use one outside the bank.`;

export type WeeklyReviewView = {
  id: string;
  weekStart: string;
  status: "draft" | "answered" | "generated" | "approved";
  metrics: WeeklyMetrics | null;
  brief: WeeklyBrief | null;
  answers: Record<string, string>;
};

async function fetchMetrics(
  userId: string,
  weekStart: string,
  weekEnd: string,
  client?: SupabaseClient<Database>
): Promise<WeeklyMetrics> {
  const supabase = client ?? (await createClient());
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
    getApprovedParameterValue(userId, "nutrition", "calorie_target", supabase),
    getApprovedParameterValue(userId, "nutrition", "protein_target_g", supabase),
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

export async function getOrCreateWeeklyReview(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<WeeklyReviewView> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);

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
      answers: (existing.answers as Record<string, string> | null) ?? {},
    };
  }

  const today = await todayIso(supabase, userId);
  const metrics = await fetchMetrics(userId, weekStart, today, supabase);
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
    answers: {},
  };
}

/**
 * Saves (merges) this week's lightweight-interview answers. Called
 * repeatedly as the mobile interview step's fields lose focus, so
 * partial answers survive the app being backgrounded mid-interview.
 * Ensures a draft weekly_reviews row exists first (a user could open the
 * interview before ever loading the review page).
 */
export async function saveReviewAnswers(
  userId: string,
  answers: Record<string, string>,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);

  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("id, answers, status")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!existing) {
    await getOrCreateWeeklyReview(userId, supabase);
  }

  const priorAnswers = (existing?.answers as Record<string, string> | null) ?? {};
  const mergedAnswers = { ...priorAnswers, ...answers };
  // Only "answered" while still a draft — don't downgrade a week that
  // already has a generated/approved brief just because the user tweaked
  // an interview answer afterward.
  const nextStatus = existing?.status === "draft" || !existing ? "answered" : existing.status;

  const { error } = await supabase
    .from("weekly_reviews")
    .update({ answers: mergedAnswers, status: nextStatus })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export type ReviewFactsBundle = {
  currentPhase: { name: string; mission: string | null } | null;
  activeGoals: {
    id: string;
    outcome: string;
    domain: string;
    targetDate: string | null;
    priority: number | null;
  }[];
  nutritionTargets: {
    calorieTarget: number | null;
    proteinTarget: number | null;
    expectedWeeklyRateLb: number | null;
  } | null;
  recentMemories: { type: string; content: string; evidence: string | null }[];
  previousWeekPriorities: string[];
  weeklyMetricsHistory: { weekStart: string; metrics: WeeklyMetrics }[];
  correlationFindings: ReturnType<typeof computeMetricCorrelations>;
  achievements: AchievementFacts;
  goalTrajectories: GoalTrajectory[];
  streaks: StreakFacts;
  experimentOutcomes: ExperimentOutcome[];
};

/**
 * Computes every deterministic (non-AI) fact the weekly-review engine
 * needs — shared by `generateWeeklyBrief` (which feeds this into the AI
 * context) and `getReviewFactsBundle` (a plain read for the mobile
 * Streaks/Vitals/Plan-Recap tabs, so they work even before a brief is
 * generated, without duplicating this ~80 lines of query/computation
 * logic in two places). `persistExperimentOutcomes` is true only from
 * the generation path — a read endpoint shouldn't have write
 * side-effects, even idempotent ones.
 */
async function computeReviewFacts(
  supabase: SupabaseClient<Database>,
  userId: string,
  weekStart: string,
  today: string,
  timezone: string,
  currentMetrics: WeeklyMetrics,
  persistExperimentOutcomes: boolean
): Promise<ReviewFactsBundle> {
  const [
    { data: phases },
    { data: goalsRaw },
    { data: previousReviewRow },
    { data: metricsHistoryRaw },
    recentMemories,
    expectedWeeklyRateLb,
    calorieTarget,
    proteinTarget,
    streaks,
  ] = await Promise.all([
    supabase.from("phases").select("name, mission").eq("user_id", userId).eq("is_current", true).limit(1),
    supabase
      .from("goals")
      .select(
        "id, outcome, target_date, priority, domains(key), target_metric_type, target_value, target_direction, baseline_value, baseline_recorded_at"
      )
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("weekly_reviews")
      .select("id, metrics, brief")
      .eq("user_id", userId)
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weekly_reviews")
      .select("week_start, metrics")
      .eq("user_id", userId)
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(METRICS_HISTORY_WEEKS),
    getRecentMemories(userId, 20, supabase),
    getApprovedParameterValue(userId, "nutrition", "expected_weekly_rate_lb", supabase),
    getApprovedParameterValue(userId, "nutrition", "calorie_target", supabase),
    getApprovedParameterValue(userId, "nutrition", "protein_target_g", supabase),
    computeStreaks(supabase, userId, timezone, today),
  ]);

  const previousBrief = previousReviewRow?.brief as WeeklyBrief | null;
  const weeklyMetricsHistory = (metricsHistoryRaw ?? []).map((row) => ({
    weekStart: row.week_start,
    metrics: row.metrics as WeeklyMetrics,
  }));
  const previousWeekMetrics = weeklyMetricsHistory[0]?.metrics ?? null;

  // Full history for correlation/trajectory analysis includes the current
  // (just-computed) week alongside the past ones fetched above.
  const historyIncludingCurrent = [{ weekStart, metrics: currentMetrics }, ...weeklyMetricsHistory];

  const correlationFindings = computeMetricCorrelations(historyIncludingCurrent);
  const achievements: AchievementFacts = computeAchievements(
    currentMetrics,
    weeklyMetricsHistory,
    previousWeekMetrics,
    streaks as StreakFacts
  );

  const goalsWithTargets: GoalWithTarget[] = (goalsRaw ?? []).map((g) => ({
    id: g.id,
    targetMetricType: g.target_metric_type as GoalWithTarget["targetMetricType"],
    targetValue: g.target_value,
    targetDirection: g.target_direction as GoalWithTarget["targetDirection"],
    targetDate: g.target_date,
    baselineValue: g.baseline_value,
    baselineRecordedAt: g.baseline_recorded_at,
  }));
  const goalTrajectories: GoalTrajectory[] = computeGoalTrajectories(goalsWithTargets, historyIncludingCurrent);

  // Closed-loop experiment evaluation: did last week's accepted,
  // hypothesis-bearing recommendations actually move the metric they
  // named? Only possible once there's a previous week to compare against.
  let experimentOutcomes: ExperimentOutcome[] = [];
  if (previousReviewRow) {
    const { data: previousRecommendationsRaw } = await supabase
      .from("recommendations")
      .select("id, field, accepted, expected_metric, expected_direction")
      .eq("weekly_review_id", previousReviewRow.id);

    const previousRecommendations: EvaluableRecommendation[] = (previousRecommendationsRaw ?? []).map((r) => ({
      id: r.id,
      field: r.field,
      accepted: r.accepted,
      expectedMetric: r.expected_metric as ExpectedMetricKey | null,
      expectedDirection: r.expected_direction as ExpectedDirection | null,
    }));

    experimentOutcomes = evaluateExperimentOutcomes(
      { metrics: previousReviewRow.metrics as WeeklyMetrics, recommendations: previousRecommendations },
      currentMetrics
    );

    if (persistExperimentOutcomes) {
      // Persist the evaluation back onto last week's rows — best-effort,
      // this is the only point both before/after values are available.
      try {
        await Promise.all(
          experimentOutcomes.map((o) =>
            supabase
              .from("recommendations")
              .update({
                outcome_classification: o.classification,
                outcome_metric_before: o.before,
                outcome_metric_after: o.after,
                evaluated_at: new Date().toISOString(),
              })
              .eq("id", o.recommendationId)
          )
        );
      } catch {
        // Non-fatal — the outcomes still reach the caller below.
      }
    }
  }

  return {
    currentPhase: phases && phases.length > 0 ? { name: phases[0].name, mission: phases[0].mission } : null,
    activeGoals: (goalsRaw ?? []).map((g) => ({
      id: g.id,
      outcome: g.outcome,
      domain: (g.domains as unknown as { key: string } | null)?.key ?? "general",
      targetDate: g.target_date,
      priority: g.priority,
    })),
    nutritionTargets:
      calorieTarget || proteinTarget ? { calorieTarget, proteinTarget, expectedWeeklyRateLb } : null,
    recentMemories: recentMemories.map((m) => ({
      type: m.type,
      content: m.content,
      evidence: m.evidence,
    })),
    previousWeekPriorities: previousBrief?.priorities.map((p) => p.title) ?? [],
    weeklyMetricsHistory,
    correlationFindings,
    achievements,
    goalTrajectories,
    streaks: streaks as StreakFacts,
    experimentOutcomes,
  };
}

/**
 * Plain read of this week's deterministic facts bundle — no AI call, no
 * writes. Powers the mobile Plan-Recap/Vitals/Streaks tabs, which should
 * work even before the user has generated (or without ever generating)
 * an AI brief for the week.
 */
export async function getReviewFactsBundle(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ReviewFactsBundle> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);
  const today = await todayIso(supabase, userId);
  const timezone = await resolveTimezone(supabase, userId);
  const review = await getOrCreateWeeklyReview(userId, supabase);
  return computeReviewFacts(
    supabase,
    userId,
    weekStart,
    today,
    timezone,
    review.metrics as WeeklyMetrics,
    false
  );
}

export async function generateWeeklyBrief(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);
  const today = await todayIso(supabase, userId);
  const timezone = await resolveTimezone(supabase, userId);

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review) {
    return { ok: false, error: "Open the review page before generating a brief." };
  }

  const currentMetrics = review.metrics as WeeklyMetrics;

  const facts = await computeReviewFacts(supabase, userId, weekStart, today, timezone, currentMetrics, true);

  const context = buildWeeklyReviewContext({
    weekStart,
    currentPhase: facts.currentPhase,
    activeGoals: facts.activeGoals,
    metrics: currentMetrics,
    nutritionTargets: facts.nutritionTargets,
    recentMemories: facts.recentMemories,
    previousWeekPriorities: facts.previousWeekPriorities,
    weeklyMetricsHistory: facts.weeklyMetricsHistory,
    correlationFindings: facts.correlationFindings,
    achievements: facts.achievements,
    goalTrajectories: facts.goalTrajectories,
    streaks: facts.streaks,
    experimentOutcomes: facts.experimentOutcomes,
    interviewAnswers: (review.answers as Record<string, string> | null) ?? {},
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
        expected_metric: c.expectedMetric ?? null,
        expected_direction: c.expectedDirection ?? null,
      }))
    );
  }

  // Promote this week's interview answers into durable memory (CLAUDE.md
  // §7 Layer 4) as unconfirmed facts — best-effort, never blocks the
  // brief itself. There's no confirm/review UI yet, so these accumulate
  // with user_confirmed: false (the `memories` table's default) until one
  // exists.
  for (const [key, value] of Object.entries(context.interviewAnswers)) {
    if (!value || !value.trim()) continue;
    const memoryType = ANSWER_MEMORY_TYPE[key];
    if (!memoryType) continue;
    try {
      await createMemory(
        userId,
        {
          type: memoryType,
          content: value.trim(),
          evidence: `Weekly review interview, week of ${weekStart}`,
          confidence: 0.5,
        },
        supabase
      );
    } catch {
      // Non-fatal.
    }
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
  accepted: boolean | null;
  expectedMetric: string | null;
  expectedDirection: string | null;
  outcomeClassification: string | null;
  outcomeMetricBefore: number | null;
  outcomeMetricAfter: number | null;
};

export async function getRecommendationsForCurrentReview(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<RecommendationView[]> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review) return [];

  const { data, error } = await supabase
    .from("recommendations")
    .select(
      "id, field, previous_value, proposed_value, reason, confidence, accepted, expected_metric, expected_direction, outcome_classification, outcome_metric_before, outcome_metric_after"
    )
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
    accepted: r.accepted,
    expectedMetric: r.expected_metric,
    expectedDirection: r.expected_direction,
    outcomeClassification: r.outcome_classification,
    outcomeMetricBefore: r.outcome_metric_before,
    outcomeMetricAfter: r.outcome_metric_after,
  }));
}

export type ReviewSummaryBundle = {
  weekStart: string;
  status: WeeklyReviewView["status"];
  metrics: WeeklyMetrics | null;
  brief: WeeklyBrief | null;
  answers: Record<string, string>;
  recommendations: RecommendationView[];
  previousWeekMetrics: WeeklyMetrics | null;
  achievements: AchievementFacts;
  goalTrajectories: GoalTrajectory[];
  streaks: StreakFacts;
  correlationFindings: ReviewFactsBundle["correlationFindings"];
  experimentOutcomes: ExperimentOutcome[];
};

/** Everything the Review tab's sub-tabs need in one round trip — shared by
 * the mobile bearer route (app/api/review/route.ts) and the web app's own
 * /review pages, so the two never assemble this bundle two different ways.
 * Read-only: getReviewFactsBundle recomputes the deterministic facts fresh
 * (cheap — pure queries/math, no AI call), so this works whether or not a
 * brief has been generated yet this week. */
export async function getReviewSummaryBundle(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ReviewSummaryBundle> {
  const supabase = client ?? (await createClient());

  const [review, recommendations, facts] = await Promise.all([
    getOrCreateWeeklyReview(userId, supabase),
    getRecommendationsForCurrentReview(userId, supabase),
    getReviewFactsBundle(userId, supabase),
  ]);

  return {
    weekStart: review.weekStart,
    status: review.status,
    metrics: review.metrics,
    brief: review.brief,
    answers: review.answers,
    recommendations,
    previousWeekMetrics: facts.weeklyMetricsHistory[0]?.metrics ?? null,
    achievements: facts.achievements,
    goalTrajectories: facts.goalTrajectories,
    streaks: facts.streaks,
    correlationFindings: facts.correlationFindings,
    experimentOutcomes: facts.experimentOutcomes,
  };
}
