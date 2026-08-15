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
export async function computeInsightCandidates(
  userId: string,
  supabase: SupabaseClient<Database>,
  options: { includePatternScans: boolean }
): Promise<InsightCandidate[]> {
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
        .select("day, steps_total, workout_count, workout_total_minutes")
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

  return [
    ...detectPersonalRecords(input),
    ...detectBehaviorStreaks(input),
    ...(options.includePatternScans
      ? [
          ...detectSleepNextDayCompletion(input),
          ...detectWeekdayPattern(input),
          ...detectWorkoutTimingSleep(input),
          ...detectWeekendShift(input),
        ]
      : []),
  ];
}

export async function computeAndStoreInsights(
  userId: string,
  supabase: SupabaseClient<Database>,
  options: { includePatternScans: boolean }
): Promise<ComputeInsightsResult> {
  const candidates = await computeInsightCandidates(userId, supabase, options);
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
