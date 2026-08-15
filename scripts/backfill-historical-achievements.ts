/**
 * One-off ops helper: emit the achievements a user genuinely reached in
 * the past but that never became insights.
 *
 * Why they're missing: the live detectors only ever fire the LARGEST
 * milestone crossed (someone at 100 workouts never sees 10/25/50), and
 * day records are gated on freshness — a record set today or yesterday
 * fires, an all-time best from last year never does. So a long-running
 * account can have a rich history and a nearly empty insight feed.
 *
 * Everything emitted here actually happened; nothing is invented. Each
 * row is dated to WHEN it happened (period_end and created_at both), and
 * inserted as `seen` rather than `new` — a milestone from 2024 is history,
 * not a fresh discovery, and shouldn't light up the "New about you" dots.
 *
 * Uses the same dedupe_key format as the live detectors, so already-fired
 * achievements are skipped and re-running is safe.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/backfill-historical-achievements.ts <email> [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { buildAccumulationSeries } from "@/domains/insights/series";
import { STEP_MILESTONES, WORKOUT_MILESTONES } from "@/domains/insights/detectors/personal-record";
import { personalRecordHeadline } from "@/domains/insights/templates";
import type { FactValue } from "@/domains/insights/types";

/** Same guards the live day-record detector applies, so a backfilled
 * record means the same thing a naturally-fired one does. */
const MIN_HISTORY_DAYS_FOR_DAY_RECORD = 30;
const MIN_WORKOUT_DAYS_FOR_RECORD = 10;

type Row = { day: string; stepsTotal: number; workoutCount: number; workoutTotalMinutes: number };

type PendingInsight = {
  type: string;
  grain: "day" | "week" | "lifetime";
  periodStart: string | null;
  periodEnd: string;
  facts: Record<string, FactValue>;
  headline: string;
  score: number;
  dedupeKey: string;
};

/** Milestones crossed before the latest one — each dated to the day the
 * running total actually reached it, with its curve ending there rather
 * than at today, so the card is about that moment. */
function milestoneInsights(
  history: Row[],
  valueOf: (row: Row) => number,
  milestones: number[],
  kind: "workout_milestone" | "steps_milestone",
  score: number
): PendingInsight[] {
  const out: PendingInsight[] = [];
  for (const milestone of milestones) {
    let running = 0;
    let crossedAt: string | null = null;
    let crossedIndex = -1;
    for (const [i, row] of history.entries()) {
      running += valueOf(row);
      if (running >= milestone) {
        crossedAt = row.day;
        crossedIndex = i;
        break;
      }
    }
    if (!crossedAt) break; // milestones ascend: nothing beyond this was reached

    const upToCrossing = history.slice(0, crossedIndex + 1);
    const series = buildAccumulationSeries(
      upToCrossing.map((r) => ({ day: r.day, value: valueOf(r) })),
      milestone
    );
    const facts = { kind, value: milestone, day: null, milestone, series };
    const dedupeKey = `personal_record:${kind}:${milestone}`;
    out.push({
      type: "personal_record",
      grain: "lifetime",
      periodStart: upToCrossing[0]?.day ?? null,
      periodEnd: crossedAt,
      facts,
      headline: personalRecordHeadline(facts, dedupeKey),
      score,
      dedupeKey,
    });
  }
  return out;
}

/** Peak-preserving downsample of the whole history to `buckets` bars,
 * keeping each bucket's maximum so the record can never be averaged away.
 *
 * The live detector charts a record against the ~60 days leading up to it,
 * which works because it only ever fires on a fresh record. A backfilled
 * record is usually old, so the honest picture is the opposite: show it
 * standing over ALL history, before and after. Anything less either
 * truncates the chart to the handful of days that preceded an early
 * record, or forces picking a later, smaller day and calling it "your most
 * ever" — which would simply be false. */
function peakOverFullHistory(
  history: Row[],
  valueOf: (row: Row) => number,
  recordDay: string,
  buckets = 60
): { values: number[]; recordIndex: number; previousBest: number } | null {
  // Only days that actually recorded the metric. A zero-step day is a day
  // the device wasn't worn, not a day of no walking — charting those as
  // empty bars left a dead gap across most of the card (seen live) and
  // compared the record against absence rather than against real days.
  const active = history.filter((r) => valueOf(r) > 0);
  if (active.length < 2) return null;
  const size = Math.max(1, Math.ceil(active.length / buckets));

  const values: number[] = [];
  let recordIndex = -1;
  for (let i = 0; i < active.length; i += size) {
    const slice = active.slice(i, i + size);
    values.push(Math.round(Math.max(...slice.map(valueOf), 0)));
    if (slice.some((r) => r.day === recordDay)) recordIndex = values.length - 1;
  }
  if (recordIndex === -1) return null;

  let previousBest = 0;
  for (const row of active) {
    if (row.day !== recordDay && valueOf(row) > previousBest) previousBest = valueOf(row);
  }
  return { values, recordIndex, previousBest: Math.round(previousBest) };
}

/** The all-time best single day for a metric, dated to that day. The
 * `minQualifyingDays` guard is applied to the history as a whole (enough
 * data to say "ever" at all), not to the days preceding the record — see
 * peakOverFullHistory for why. */
function dayRecordInsight(
  history: Row[],
  valueOf: (row: Row) => number,
  kind: "steps_day" | "workout_minutes_day",
  minQualifyingDays: number,
  score: number
): PendingInsight | null {
  const active = history.filter((r) => valueOf(r) > 0);
  if (active.length < minQualifyingDays) return null;

  const best = active.reduce((a, b) => (valueOf(b) > valueOf(a) ? b : a));
  const peak = peakOverFullHistory(history, valueOf, best.day);
  const series = peak ? { kind: "peak" as const, ...peak } : null;
  const facts = { kind, value: valueOf(best), day: best.day, milestone: null, series };
  const dedupeKey = `personal_record:${kind}:${best.day}`;
  return {
    type: "personal_record",
    grain: "day",
    periodStart: best.day,
    periodEnd: best.day,
    facts,
    headline: personalRecordHeadline(facts, dedupeKey),
    score,
    dedupeKey,
  };
}

async function main() {
  const email = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!email) {
    console.error("Usage: backfill-historical-achievements.ts <email> [--dry-run]");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = userList?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user with email ${email}`);

  const { data: rows, error } = await supabase
    .from("activity_daily_summaries")
    .select("day, steps_total, workout_count, workout_total_minutes")
    .eq("user_id", user.id)
    .order("day", { ascending: true });
  if (error) throw new Error(`summaries fetch failed: ${error.message}`);

  const history: Row[] = (rows ?? []).map((r) => ({
    day: r.day,
    stepsTotal: r.steps_total,
    workoutCount: r.workout_count,
    workoutTotalMinutes: r.workout_total_minutes,
  }));
  if (history.length === 0) throw new Error("no activity summaries for this user");
  console.log(`${history.length} days of history (${history[0].day} -> ${history[history.length - 1].day})`);

  const candidates: PendingInsight[] = [
    ...milestoneInsights(history, (r) => r.workoutCount, WORKOUT_MILESTONES, "workout_milestone", 86),
    ...milestoneInsights(history, (r) => r.stepsTotal, STEP_MILESTONES, "steps_milestone", 84),
    dayRecordInsight(history, (r) => r.stepsTotal, "steps_day", MIN_HISTORY_DAYS_FOR_DAY_RECORD, 82),
    dayRecordInsight(history, (r) => r.workoutTotalMinutes, "workout_minutes_day", MIN_WORKOUT_DAYS_FOR_RECORD, 80),
  ].filter((c): c is PendingInsight => c !== null);

  const force = process.argv.includes("--force");
  const { data: existing } = await supabase.from("insights").select("id, dedupe_key").eq("user_id", user.id);
  const existingByKey = new Map((existing ?? []).map((r) => [r.dedupe_key, r.id]));
  const fresh = candidates.filter((c) => !existingByKey.has(c.dedupeKey));

  // --force re-renders the facts of rows this script already wrote — for
  // when the series-building itself is corrected, since nothing else in
  // the system ever updates an existing insight's facts.
  if (force) {
    const stale = candidates.filter((c) => existingByKey.has(c.dedupeKey));
    for (const c of stale) {
      console.log(`  ${dryRun ? "[dry-run] " : ""}refresh ${c.dedupeKey}`);
      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("insights")
          .update({ facts: c.facts, headline: c.headline })
          .eq("id", existingByKey.get(c.dedupeKey)!);
        if (updateError) throw new Error(`refresh failed for ${c.dedupeKey}: ${updateError.message}`);
      }
    }
  }

  console.log(`\n${candidates.length} historical achievement(s) found, ${candidates.length - fresh.length} already fired:\n`);
  for (const c of fresh) {
    console.log(`  ${dryRun ? "[dry-run] " : ""}${c.periodEnd}  ${c.headline}`);
  }
  if (fresh.length === 0) {
    console.log("  (nothing to add)");
    return;
  }

  if (!dryRun) {
    const { error: insertError } = await supabase.from("insights").insert(
      fresh.map((c) => ({
        user_id: user.id,
        type: c.type,
        grain: c.grain,
        period_start: c.periodStart,
        period_end: c.periodEnd,
        facts: c.facts,
        headline: c.headline,
        score: c.score,
        dedupe_key: c.dedupeKey,
        // History, not news: no "new" dot, and dated to when it happened
        // so the gallery reads chronologically instead of all-at-once.
        status: "seen",
        seen_at: new Date().toISOString(),
        created_at: `${c.periodEnd}T12:00:00Z`,
      }))
    );
    if (insertError) throw new Error(`insert failed: ${insertError.message}`);
  }

  console.log(`\n${dryRun ? "would insert" : "inserted"}: ${fresh.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
