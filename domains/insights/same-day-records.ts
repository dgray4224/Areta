import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { sendPushToUser } from "@/platform/push/send";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import { detectPersonalRecords } from "./detectors/personal-record";
import { detectRunningPaceRecord, MILE_METERS, type RunForPace } from "./detectors/running-pace";
import { addDaysToDateString } from "./dates";
import { fetchAllTimeSummaryRows } from "./service";
import type { InsightCandidate } from "./types";

/**
 * Same-day personal records (2026-09-04). The daily insight cron sees a
 * record the morning after; this runs on every health sync that touches
 * today or yesterday, so "you just set a record" arrives while it still
 * feels like it just happened. Records are the one insight class where
 * the moment is the value.
 *
 * Deliberately narrow: only the deterministic record detectors, fed by a
 * single paged history read plus one workout-log read — never the full
 * insight bundle (8-18 queries, two paged scans), which would run on
 * every sync. Called from the ingest route's post-response hook, so it
 * must never throw: every failure is logged and swallowed.
 *
 * A day record can keep climbing after it first fires (a 14k-step record
 * at 2pm is 22k by night). The engine's plain-insert dedupe would freeze
 * the first value forever, so day records here UPDATE in place when the
 * new value is better — the dedupe key still pins the day, and the
 * morning cron's identical candidate stays a no-op. Improvements do not
 * re-push; one notification per record is the whole budget.
 */

const RUN_ACTIVITY_TYPES = ["running"];
const RUN_PAGE_SIZE = 1000;
const RUN_ROW_LIMIT = 4000;
const PUSH_MIN_SCORE = 75;
/** One record push per user per day, independent of the cron's weekly
 * "New about you" budget — a record is the higher-value moment, and a
 * cron push earlier in the week must not silence it. */
const RECORD_PUSH_WINDOW_MS = 24 * 60 * 60 * 1000;

type StoredRecord = { id: string; dedupe_key: string; facts: unknown };

/** Lower is better for pace; higher for everything else. */
export function isBetterRecord(kind: string, candidateValue: number, storedValue: number): boolean {
  return kind === "running_pace_mile" ? candidateValue < storedValue : candidateValue > storedValue;
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "");
}

function factsValue(facts: unknown): number | null {
  if (!facts || typeof facts !== "object") return null;
  const value = (facts as { value?: unknown }).value;
  return typeof value === "number" ? value : null;
}

async function fetchRuns(supabase: SupabaseClient<Database>, userId: string, timezone: string): Promise<RunForPace[]> {
  const runs: RunForPace[] = [];
  for (let from = 0; from < RUN_ROW_LIMIT; from += RUN_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("health_metrics")
      .select("started_at, ended_at, total_distance_meters")
      .eq("user_id", userId)
      .eq("metric_type", "workout")
      .in("activity_type", RUN_ACTIVITY_TYPES)
      .gte("total_distance_meters", MILE_METERS)
      .order("started_at", { ascending: true })
      .range(from, Math.min(from + RUN_PAGE_SIZE, RUN_ROW_LIMIT) - 1);
    if (error) throw new Error(`same-day records: workout fetch failed: ${error.message}`);
    for (const row of data ?? []) {
      if (!row.ended_at) continue;
      const start = new Date(row.started_at);
      const end = new Date(row.ended_at);
      runs.push({
        day: localDateString(start, timezone),
        distanceMeters: Number(row.total_distance_meters ?? 0),
        // Wall-clock span rather than the integer duration_minutes column:
        // a 7:30 mile over 5k rounds to a whole minute there, which is
        // ±10 s/mi of error on the one number this record is about.
        durationSeconds: (end.getTime() - start.getTime()) / 1000,
      });
    }
    if (!data || data.length < RUN_PAGE_SIZE) break;
  }
  return runs;
}

type StoreResult = { created: { id: string; type: string; score: number; headline: string }[]; improved: number };

async function storeRecordCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  candidates: InsightCandidate[]
): Promise<StoreResult> {
  if (candidates.length === 0) return { created: [], improved: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("insights")
    .select("id, dedupe_key, facts")
    .eq("user_id", userId)
    .in(
      "dedupe_key",
      candidates.map((c) => c.dedupeKey)
    );
  if (existingError) throw new Error(`same-day records: dedupe check failed: ${existingError.message}`);
  const byKey = new Map<string, StoredRecord>((existing ?? []).map((row) => [row.dedupe_key, row]));

  const toInsert: InsightCandidate[] = [];
  let improved = 0;
  for (const candidate of candidates) {
    const stored = byKey.get(candidate.dedupeKey);
    if (!stored) {
      toInsert.push(candidate);
      continue;
    }
    // Only day records improve in place; milestones are fixed thresholds.
    const kind = String(candidate.facts.kind ?? "");
    const candidateValue = factsValue(candidate.facts);
    const storedValue = factsValue(stored.facts);
    const isDayRecord = candidate.facts.day !== null && candidate.facts.day !== undefined;
    if (!isDayRecord || candidateValue === null || storedValue === null) continue;
    if (!isBetterRecord(kind, candidateValue, storedValue)) continue;
    const { error: updateError } = await supabase
      .from("insights")
      .update({ facts: candidate.facts, headline: candidate.headline, score: candidate.score })
      .eq("id", stored.id)
      .eq("user_id", userId);
    if (updateError) throw new Error(`same-day records: update failed: ${updateError.message}`);
    improved += 1;
  }

  if (toInsert.length === 0) return { created: [], improved };
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
        tier: c.tier ?? null,
        generator_key: c.generatorKey ?? "same_day_record",
        generator_version: c.generatorVersion ?? 1,
      }))
    )
    .select("id, type, score, headline");
  if (insertError) throw new Error(`same-day records: insert failed: ${insertError.message}`);
  return {
    created: (inserted ?? []).map((row) => ({ id: row.id, type: row.type, score: row.score, headline: row.headline })),
    improved,
  };
}

async function pushBestRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
  created: StoreResult["created"]
): Promise<void> {
  const best = created.filter((c) => c.score >= PUSH_MIN_SCORE).sort((a, b) => b.score - a.score)[0];
  if (!best) return;

  const cutoff = new Date(Date.now() - RECORD_PUSH_WINDOW_MS).toISOString();
  const { data: recent, error } = await supabase
    .from("insights")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "personal_record")
    .gte("pushed_at", cutoff)
    .limit(1);
  if (error) throw new Error(`same-day records: push throttle check failed: ${error.message}`);
  if ((recent ?? []).length > 0) return;

  await sendPushToUser(userId, { title: "New personal record", body: stripMarkdown(best.headline), screen: "insights" }, supabase);
  await supabase.from("insights").update({ pushed_at: new Date().toISOString() }).eq("id", best.id).eq("user_id", userId);
}

/**
 * Run after a health sync for the days it touched. No-op unless one of
 * them is the user's today or yesterday — a backfill chunk from 2023
 * cannot set a record that is news.
 */
export async function checkSameDayRecords(
  supabase: SupabaseClient<Database>,
  userId: string,
  touchedDays: ReadonlySet<string>
): Promise<void> {
  try {
    const timezone = await resolveTimezone(supabase, userId);
    const today = localDateString(new Date(), timezone);
    const yesterday = addDaysToDateString(today, -1);
    if (!touchedDays.has(today) && !touchedDays.has(yesterday)) return;

    const [rows, runs] = await Promise.all([fetchAllTimeSummaryRows(supabase, userId), fetchRuns(supabase, userId, timezone)]);
    const allTimeSummaries = rows.map((r) => ({
      day: r.day,
      stepsTotal: r.steps_total ?? 0,
      workoutCount: r.workout_count ?? 0,
      workoutTotalMinutes: r.workout_total_minutes ?? 0,
    }));

    const candidates = detectPersonalRecords({ allTimeSummaries, today });
    const pace = detectRunningPaceRecord({ runs, today });
    if (pace) candidates.push(pace);

    const result = await storeRecordCandidates(supabase, userId, candidates);
    await pushBestRecord(supabase, userId, result.created);
  } catch (error) {
    console.error("same-day record check failed", { userId, error });
  }
}
