import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import { addDaysToDateString } from "./dates";
import type { DetectorInput, DayTaskCompletion, DaySummary, InsightCandidate } from "./types";
import { detectSleepNextDayCompletion } from "./detectors/sleep-next-day-completion";
import { detectWeekdayPattern } from "./detectors/weekday-pattern";
import { detectWorkoutTimingSleep } from "./detectors/workout-timing-sleep";
import { detectWeekendShift } from "./detectors/weekend-shift";
import { detectPersonalRecords } from "./detectors/personal-record";
import { detectBehaviorStreaks } from "./detectors/behavior-streak";
import { generateStepPortrait, normalizeDailySeries } from "./generators/step-portrait";
import type { Changepoint } from "./generators/changepoint";

/** Insight Engine v2 orchestrator (2026-08-14) — fetches each user's
 * day-grain data once, fans out to the pure detector battery in
 * ./detectors/, and persists the survivors to the `insights` table.
 * Mirrors domains/review/service.ts's computeReviewFacts split: everything
 * statistical lives in pure functions; this file only does IO and
 * policy (dedupe, the per-run pattern cap).
 *
 * Two cadences, one entry point (see app/api/cron/generate-insights):
 * - records/streaks (cheap, deserve same-day delivery) run every day;
 * - pattern scans (slow-moving, statistical) only when
 *   `includePatternScans` — the cron passes true on the user's own
 *   weekly_review_day, same gating the weekly-review cron uses.
 */

/** 120 days ≈ 17 weeks of day-grain samples — enough for every detector's
 * minimum-n guard while keeping "you lately" honest (a habit from a year
 * ago shouldn't drive a present-tense headline). */
const WINDOW_DAYS = 120;

/** Retention caps health imports at 3 years (platform/health/retention.ts),
 * so 1200 rows covers the densest possible all-time summary history. */
const ALL_TIME_ROW_LIMIT = 1200;

/** At most this many NEW pattern insights persist per run — the third
 * layer of multiple-comparison control after per-detector effect floors
 * and (where scans are wide) Bonferroni. Records/streaks are exempt: they
 * are deterministic facts, not hypotheses. */
const MAX_NEW_PATTERN_INSIGHTS_PER_RUN = 2;

const PATTERN_TYPES = new Set([
  "sleep_next_day_completion",
  "weekday_pattern",
  "workout_timing_sleep",
  "weekend_shift",
]);

export type CreatedInsight = {
  id: string;
  type: string;
  score: number;
  headline: string;
};

export type ComputeInsightsResult = {
  created: number;
  /** Candidates whose dedupe_key already existed (cooldown / already fired). */
  duplicates: number;
  /** The rows actually inserted this run — the cron's push logic picks
   * its notification candidate from these. */
  createdInsights: CreatedInsight[];
};

/** Run the detector battery for one user and return the candidates,
 * without touching the `insights` table. Split out of
 * computeAndStoreInsights so ops tooling can recompute a user's facts
 * (e.g. to attach share-card series to insights that fired before those
 * existed) without going through the insert path, which deliberately
 * drops any candidate whose dedupe_key already fired. */
export async function computeInsightBundle(
  userId: string,
  supabase: SupabaseClient<Database>,
  options: { includePatternScans: boolean }
): Promise<{ candidates: InsightCandidate[]; changepoints: Changepoint[] }> {
  const timezone = await resolveTimezone(supabase, userId);
  const today = localDateString(new Date(), timezone);
  const windowStart = addDaysToDateString(today, -WINDOW_DAYS);

  const [{ data: windowRows, error: windowError }, { data: allTimeRows, error: allTimeError }, { data: actions, error: actionsError }] =
    await Promise.all([
      supabase
        .from("activity_daily_summaries")
        .select(
          "day, day_of_week, is_weekend, steps_total, steps_most_active_local_hour, sleep_total_duration_minutes, workout_count, workout_total_minutes, workout_first_start_local_hour"
        )
        .eq("user_id", userId)
        .gte("day", windowStart)
        .order("day", { ascending: true }),
      supabase
        .from("activity_daily_summaries")
        // day_of_week and steps_most_active_local_hour ride along for the
        // Tier 0/1 generators, which reason over the WHOLE history rather
        // than the 120-day window the older detectors use — a weekday
        // signature or a seasonal shape is meaningless inside 17 weeks.
        .select("day, steps_total, workout_count, workout_total_minutes, day_of_week, steps_most_active_local_hour")
        .eq("user_id", userId)
        .order("day", { ascending: true })
        .limit(ALL_TIME_ROW_LIMIT),
      supabase.from("daily_actions").select("date, status").eq("user_id", userId).gte("date", windowStart),
    ]);
  if (windowError || allTimeError || actionsError) {
    throw new Error(
      `insights fetch failed: ${windowError?.message ?? allTimeError?.message ?? actionsError?.message}`
    );
  }

  const summaries: DaySummary[] = (windowRows ?? []).map((r) => ({
    day: r.day,
    dayOfWeek: r.day_of_week,
    isWeekend: r.is_weekend,
    stepsTotal: r.steps_total,
    stepsMostActiveLocalHour: r.steps_most_active_local_hour,
    sleepTotalDurationMinutes: r.sleep_total_duration_minutes,
    workoutCount: r.workout_count,
    workoutTotalMinutes: r.workout_total_minutes,
    workoutFirstStartLocalHour: r.workout_first_start_local_hour,
  }));

  const taskCompletions = computeTaskCompletions(actions ?? []);

  const input: DetectorInput = {
    summaries,
    taskCompletions,
    allTimeSummaries: (allTimeRows ?? []).map((r) => ({
      day: r.day,
      stepsTotal: r.steps_total,
      workoutCount: r.workout_count,
      workoutTotalMinutes: r.workout_total_minutes,
    })),
    today,
    seedKey: userId,
  };

  // Tier 0/1 portrait runs over full history, not the rolling window, and
  // is deliberately NOT gated behind includePatternScans: these findings
  // are the launch surface for a user who never logs anything, so they
  // cannot be reserved for the weekly slow path.
  const allTime = allTimeRows ?? [];
  const portrait = generateStepPortrait({
    series: normalizeDailySeries(allTime.map((r) => ({ day: r.day, value: r.steps_total }))),
    dayOfWeek: new Map(allTime.filter((r) => r.day_of_week !== null).map((r) => [r.day, r.day_of_week as number])),
    mostActiveHour: new Map(
      allTime
        .filter((r) => r.steps_most_active_local_hour !== null)
        .map((r) => [r.day, r.steps_most_active_local_hour as number])
    ),
    activeGoalDomains: await fetchActiveGoalDomains(userId, supabase),
    today,
  });

  return {
    candidates: [
      ...detectPersonalRecords(input),
      ...detectBehaviorStreaks(input),
      ...portrait.candidates,
      ...(options.includePatternScans
        ? [
            ...detectSleepNextDayCompletion(input),
            ...detectWeekdayPattern(input),
            ...detectWorkoutTimingSleep(input),
            ...detectWeekendShift(input),
          ]
        : []),
    ],
    changepoints: portrait.changepoints,
  };
}

/**
 * Domain keys the user currently has an active goal in, for the scorer's
 * goal-relevance dimension. Empty set on any failure: goal relevance is
 * one of five inputs and never worth failing a whole insight run over.
 */
async function fetchActiveGoalDomains(userId: string, supabase: SupabaseClient<Database>): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("goals")
    .select("domains(key)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error || !data) return new Set();

  const keys = new Set<string>();
  for (const row of data) {
    const domain = row.domains as { key: string } | { key: string }[] | null;
    if (!domain) continue;
    if (Array.isArray(domain)) domain.forEach((d) => keys.add(d.key));
    else keys.add(domain.key);
  }
  return keys;
}

/** Back-compat wrapper: ops tooling recomputes candidates without caring
 * about changepoints. */
export async function computeInsightCandidates(
  userId: string,
  supabase: SupabaseClient<Database>,
  options: { includePatternScans: boolean }
): Promise<InsightCandidate[]> {
  return (await computeInsightBundle(userId, supabase, options)).candidates;
}

/**
 * Upserts detected changepoints, preserving any label the user has
 * already written.
 *
 * Re-running detection on a longer series can shift a changepoint's
 * estimated means, so the numbers are refreshed — but `label`,
 * `labeled_at` and `memory_id` are never written here. A user's answer to
 * "what changed in September?" is the single most valuable piece of
 * context this app can hold, and a routine cron must not be able to
 * clobber it.
 */
async function persistChangepoints(
  userId: string,
  supabase: SupabaseClient<Database>,
  changepoints: Changepoint[]
): Promise<void> {
  if (changepoints.length === 0) return;

  const { error } = await supabase.from("changepoints").upsert(
    changepoints.map((c) => ({
      user_id: userId,
      metric: "steps",
      detected_at: c.day,
      direction: c.direction,
      mean_before: Math.round(c.meanBefore),
      mean_after: Math.round(c.meanAfter),
      days_before: c.daysBefore,
      days_after: c.daysAfter,
      confidence: Math.round(Math.min(1, c.tStatistic / 10) * 100) / 100,
    })),
    { onConflict: "user_id,metric,detected_at" }
  );
  if (error) {
    // Non-fatal: the insight card still ships, it just cannot be annotated
    // until the next run succeeds.
    console.error(`[insights] changepoint upsert failed for ${userId}: ${error.message}`);
  }
}

export async function computeAndStoreInsights(
  userId: string,
  supabase: SupabaseClient<Database>,
  options: { includePatternScans: boolean }
): Promise<ComputeInsightsResult> {
  const { candidates, changepoints } = await computeInsightBundle(userId, supabase, options);

  // Persisted before the early return: a user can have a changepoint worth
  // annotating even when every insight candidate is a duplicate this run.
  await persistChangepoints(userId, supabase, changepoints);

  if (candidates.length === 0) return { created: 0, duplicates: 0, createdInsights: [] };

  // Dedupe against everything this user has ever been shown — dedupe_key
  // encodes both idempotency (same run twice) and cooldown (month buckets).
  const { data: existing, error: existingError } = await supabase
    .from("insights")
    .select("dedupe_key")
    .eq("user_id", userId)
    .in(
      "dedupe_key",
      candidates.map((c) => c.dedupeKey)
    );
  if (existingError) throw new Error(`insights dedupe check failed: ${existingError.message}`);
  const existingKeys = new Set((existing ?? []).map((row) => row.dedupe_key));

  const fresh = candidates.filter((c) => !existingKeys.has(c.dedupeKey));
  const patternInsights = fresh
    .filter((c) => PATTERN_TYPES.has(c.type))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NEW_PATTERN_INSIGHTS_PER_RUN);
  const factInsights = fresh.filter((c) => !PATTERN_TYPES.has(c.type));
  const toInsert = [...factInsights, ...patternInsights];
  if (toInsert.length === 0) return { created: 0, duplicates: candidates.length - fresh.length, createdInsights: [] };

  const { data: inserted, error: insertError } = await supabase
    .from("insights")
    .insert(
      toInsert.map((c) => ({
        user_id: userId,
        type: c.type,
        grain: c.grain,
        period_start: c.periodStart,
        period_end: c.periodEnd,
        facts: c.facts,
        headline: c.headline,
        score: c.score,
        dedupe_key: c.dedupeKey,
        // Null for the pre-2026-08-17 detectors, which still pick their
        // own score. Nullable rather than defaulted so "has not been
        // migrated onto the shared scorer yet" stays distinguishable from
        // "scored zero on that dimension".
        tier: c.tier ?? null,
        generator_key: c.generatorKey ?? null,
        generator_version: c.generatorVersion ?? 1,
        score_effect_size: c.scoreComponents?.effectSize ?? null,
        score_sample_size: c.scoreComponents?.sampleSize ?? null,
        score_actionability: c.scoreComponents?.actionability ?? null,
        score_goal_relevance: c.scoreComponents?.goalRelevance ?? null,
        score_surprise: c.scoreComponents?.surprise ?? null,
      }))
    )
    .select("id, type, score, headline");
  if (insertError) throw new Error(`insights insert failed: ${insertError.message}`);

  return {
    created: toInsert.length,
    duplicates: candidates.length - fresh.length,
    createdInsights: (inserted ?? []).map((row) => ({ id: row.id, type: row.type, score: row.score, headline: row.headline })),
  };
}

/** Per-day task completion from raw daily_actions rows — only days with at
 * least one task count (a taskless day is "no data", not "0%"). Completion
 * convention (completed + partially_completed) matches
 * domains/review/metrics.ts's taskCompletionPercent. */
export function computeTaskCompletions(actions: { date: string; status: string }[]): DayTaskCompletion[] {
  const byDay = new Map<string, { total: number; done: number }>();
  for (const action of actions) {
    const bucket = byDay.get(action.date) ?? { total: 0, done: 0 };
    bucket.total++;
    if (action.status === "completed" || action.status === "partially_completed") bucket.done++;
    byDay.set(action.date, bucket);
  }
  return [...byDay.entries()]
    .map(([day, { total, done }]) => ({
      day,
      totalTasks: total,
      completionPercent: Math.round((done / total) * 100),
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}
