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
import { generateTranslations } from "./generators/translations";
import { computeAvailability } from "./availability";
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

/** Hard ceiling on all-time summary rows, as a runaway guard only. The
 * old 1200 assumed 3-year retention AND was silently cut to 1,000 by
 * PostgREST's response cap — ascending order meant lifetime records were
 * computed over the OLDEST thousand days once retention went to 10 years
 * (2026-08-26). The fetch pages now; this cap is ~11 years of days. */
const ALL_TIME_ROW_LIMIT = 4000;
const PAGE_SIZE = 1000;

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
): Promise<{
  candidates: InsightCandidate[];
  changepoints: Changepoint[];
  /** Days this user has confirmed were an instrument change — returned so
   * computeAndStoreInsights can retract cards it already shipped for
   * them. */
  measurementChangeDays: string[];
}> {
  const timezone = await resolveTimezone(supabase, userId);
  const today = localDateString(new Date(), timezone);
  const windowStart = addDaysToDateString(today, -WINDOW_DAYS);

  const nutritionWindowStart = addDaysToDateString(today, -365);
  const [{ data: windowRows, error: windowError }, allTimeRows, { data: actions, error: actionsError }, nutritionDayRows, { data: profileRow }] =
    await Promise.all([
      supabase
        .from("activity_daily_summaries")
        .select(
          "day, day_of_week, is_weekend, steps_total, steps_most_active_local_hour, sleep_total_duration_minutes, workout_count, workout_total_minutes, workout_first_start_local_hour"
        )
        .eq("user_id", userId)
        .gte("day", windowStart)
        .order("day", { ascending: true }),
      // day_of_week and steps_most_active_local_hour ride along for the
      // Tier 0/1 generators, which reason over the WHOLE history rather
      // than the 120-day window the older detectors use — a weekday
      // signature or a seasonal shape is meaningless inside 17 weeks.
      // sleep_logged / weight_logged / heart_rate_sample_count feed
      // availability. Paged: PostgREST silently caps a response at 1,000
      // rows, and full history is several times that.
      fetchAllTimeSummaryRows(supabase, userId),
      supabase.from("daily_actions").select("date, status").eq("user_id", userId).gte("date", windowStart),
      fetchNutritionDays(supabase, userId, nutritionWindowStart),
      supabase.from("profiles").select("units").eq("id", userId).maybeSingle(),
    ]);
  if (windowError || actionsError) {
    throw new Error(`insights fetch failed: ${windowError?.message ?? actionsError?.message}`);
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

  const availability = computeAvailability({
    rows: allTimeRows.map((r) => ({
      day: r.day,
      hasSteps: r.steps_total > 0,
      hasSleep: r.sleep_logged,
      hasWorkout: r.workout_count > 0,
      hasWeight: r.weight_logged,
      hasHeartRate: r.heart_rate_sample_count > 0,
    })),
    nutritionDays: nutritionDayRows,
    // Task availability sees the 120-day window, not all time — tasks are
    // app-native, so the window is where "does this user use tasks" lives.
    taskDays: [...new Set((actions ?? []).map((a) => a.date))],
    today,
  });

  const input: DetectorInput = {
    summaries,
    taskCompletions,
    allTimeSummaries: allTimeRows.map((r) => ({
      day: r.day,
      stepsTotal: r.steps_total,
      workoutCount: r.workout_count,
      workoutTotalMinutes: r.workout_total_minutes,
    })),
    today,
    seedKey: userId,
    availability,
  };

  // Tier 0/1 portrait runs over full history, not the rolling window, and
  // is deliberately NOT gated behind includePatternScans: these findings
  // are the launch surface for a user who never logs anything, so they
  // cannot be reserved for the weekly slow path.
  const allTime = allTimeRows;
  const [measurementChangeDays, activeGoalDomains] = await Promise.all([
    fetchMeasurementChangeDays(userId, supabase),
    fetchActiveGoalDomains(userId, supabase),
  ]);
  const portrait = generateStepPortrait({
    series: normalizeDailySeries(allTime.map((r) => ({ day: r.day, value: r.steps_total }))),
    dayOfWeek: new Map(allTime.filter((r) => r.day_of_week !== null).map((r) => [r.day, r.day_of_week as number])),
    mostActiveHour: new Map(
      allTime
        .filter((r) => r.steps_most_active_local_hour !== null)
        .map((r) => [r.day, r.steps_most_active_local_hour as number])
    ),
    measurementChangeDays,
    activeGoalDomains,
    today,
  });

  return {
    measurementChangeDays,
    candidates: [
      ...detectPersonalRecords(input),
      ...detectBehaviorStreaks(input),
      ...generateTranslations({
        allTimeSummaries: input.allTimeSummaries,
        availability,
        units: profileRow?.units ?? null,
      }),
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
 * Days this user answered the annotation loop's "it was a new watch or
 * phone" on — the record of when the instrument changed, as opposed to
 * when their life did.
 *
 * Empty on any failure. Losing these reverts the portrait to its
 * pre-annotation behaviour, which is worse but not worth failing a whole
 * insight run over.
 */
async function fetchMeasurementChangeDays(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const { data, error } = await supabase
    .from("changepoints")
    .select("detected_at")
    .eq("user_id", userId)
    .eq("kind", "measurement");
  if (error || !data) return [];
  return data.map((row) => row.detected_at);
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
/** The only metric changepoint detection currently runs on. Named because
 * both the upsert and the orphan sweep below have to agree on it. */
const CHANGEPOINT_METRIC = "steps";

/**
 * Un-annotated changepoints that the current detection run no longer
 * produces, and can therefore be swept.
 *
 * Pure so the sweep's one dangerous property — that it must never take a
 * row the user has touched — is testable without a database.
 *
 * A row counts as touched if ANY of the four annotation columns is set,
 * not just `kind`. Answers written before the `kind` column existed
 * (2026-08-19) set only `label`/`labeled_at`/`memory_id`, and those are
 * the oldest and most considered answers in the table.
 */
export function orphanedChangepointIds(
  stored: {
    id: string;
    detected_at: string;
    kind: string | null;
    label: string | null;
    labeled_at: string | null;
    memory_id: string | null;
  }[],
  detectedDays: Iterable<string>
): string[] {
  const keep = new Set(detectedDays);
  return stored
    .filter(
      (row) =>
        !keep.has(row.detected_at) &&
        row.kind === null &&
        row.label === null &&
        row.labeled_at === null &&
        row.memory_id === null
    )
    .map((row) => row.id);
}

/**
 * Drops un-annotated changepoints that detection no longer finds.
 *
 * Detection runs against a growing series, and the same underlying break
 * lands on a different day as more history arrives — the account this was
 * built against has a July 2021 break stored at the 29th and detected at
 * the 30th after the full-history import completed. Without this, the
 * annotation loop asks about both, one day apart, in near-identical
 * words, and adds two more from a 2022 the detector no longer believes
 * in. Being asked the same question twice is what makes someone stop
 * answering, so the queue has to be able to shrink.
 *
 * Only untouched rows go. An annotated changepoint is the user's own
 * answer and outlives whatever the detector currently thinks.
 */
async function sweepOrphanedChangepoints(
  userId: string,
  supabase: SupabaseClient<Database>,
  detectedDays: string[]
): Promise<void> {
  const { data, error } = await supabase
    .from("changepoints")
    .select("id, detected_at, kind, label, labeled_at, memory_id")
    .eq("user_id", userId)
    .eq("metric", CHANGEPOINT_METRIC);
  if (error || !data) return;

  const orphans = orphanedChangepointIds(data, detectedDays);
  if (orphans.length === 0) return;

  const { error: deleteError } = await supabase
    .from("changepoints")
    .delete()
    .eq("user_id", userId)
    .in("id", orphans);
  if (deleteError) {
    // Non-fatal, and self-healing: the next run sweeps the same rows.
    console.error(`[insights] changepoint sweep failed for ${userId}: ${deleteError.message}`);
  }
}

async function persistChangepoints(
  userId: string,
  supabase: SupabaseClient<Database>,
  changepoints: Changepoint[]
): Promise<void> {
  // A run that found nothing is the one case where sweeping would empty
  // the whole queue, and it is far more likely to mean the series failed
  // to load than that every break the user has ever had stopped existing.
  if (changepoints.length === 0) return;

  const { error } = await supabase.from("changepoints").upsert(
    changepoints.map((c) => ({
      user_id: userId,
      metric: CHANGEPOINT_METRIC,
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
    // Skip the sweep: if the upsert failed, the rows it would have kept
    // alive may not be there, and deleting against a half-written table
    // is how a user loses a question they were about to answer.
    return;
  }

  await sweepOrphanedChangepoints(
    userId,
    supabase,
    changepoints.map((c) => c.day)
  );
}

/**
 * Retires cards this app already published for a break the user has since
 * told us was a device swap.
 *
 * The annotation loop asks "do you know what changed?" about a break the
 * feed has usually already announced in a headline. When the answer comes
 * back "I got a watch", that headline is now known to be false, and
 * leaving it standing teaches the user that answering honestly changes
 * nothing — which is the one lesson that would kill the loop.
 *
 * Reuses `dismissed` rather than adding a status: it already means "not in
 * the feed", nothing reads it as a signal of user intent, and a dismissed
 * dedupe_key still blocks the card from firing again.
 */
async function retractMeasurementArtifacts(
  userId: string,
  supabase: SupabaseClient<Database>,
  measurementChangeDays: string[]
): Promise<void> {
  if (measurementChangeDays.length === 0) return;

  const { error } = await supabase
    .from("insights")
    .update({ status: "dismissed" })
    .eq("user_id", userId)
    .eq("type", "changepoint")
    .neq("status", "dismissed")
    .in(
      "dedupe_key",
      measurementChangeDays.map((day) => `changepoint:steps:${day}`)
    );
  if (error) {
    // Non-fatal, and self-healing: the next run retries the same update.
    console.error(`[insights] measurement retraction failed for ${userId}: ${error.message}`);
  }
}

export async function computeAndStoreInsights(
  userId: string,
  supabase: SupabaseClient<Database>,
  options: { includePatternScans: boolean }
): Promise<ComputeInsightsResult> {
  const { candidates, changepoints, measurementChangeDays } = await computeInsightBundle(
    userId,
    supabase,
    options
  );

  // Both run before the early return: a user can have a changepoint worth
  // annotating, or a stale card worth retracting, even when every insight
  // candidate is a duplicate this run.
  await persistChangepoints(userId, supabase, changepoints);
  await retractMeasurementArtifacts(userId, supabase, measurementChangeDays);

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

export type AllTimeSummaryRow = {
  day: string;
  steps_total: number;
  workout_count: number;
  workout_total_minutes: number;
  day_of_week: number | null;
  steps_most_active_local_hour: number | null;
  sleep_logged: boolean;
  weight_logged: boolean;
  heart_rate_sample_count: number;
};

/** Exported for the same-day record check (same-day-records.ts), which
 * needs the full history but none of the rest of the bundle. */
export async function fetchAllTimeSummaryRows(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AllTimeSummaryRow[]> {
  const rows: AllTimeSummaryRow[] = [];
  for (let from = 0; from < ALL_TIME_ROW_LIMIT; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("activity_daily_summaries")
      .select(
        "day, steps_total, workout_count, workout_total_minutes, day_of_week, steps_most_active_local_hour, sleep_logged, weight_logged, heart_rate_sample_count"
      )
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .range(from, Math.min(from + PAGE_SIZE, ALL_TIME_ROW_LIMIT) - 1);
    if (error) throw new Error(`insights fetch failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Distinct days with >=1 nutrition log since `since` — availability
 * input only. Paged for the same PostgREST cap; rows are per food entry,
 * so a year of real logging is several thousand rows. */
async function fetchNutritionDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  since: string
): Promise<string[]> {
  const days = new Set<string>();
  for (let from = 0; from < 10_000; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("date")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`insights fetch failed: ${error.message}`);
    for (const row of data ?? []) days.add(row.date);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return [...days];
}
