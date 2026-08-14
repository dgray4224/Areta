/**
 * E2E verification for Insight Engine v2 (2026-08-14): seeds a throwaway
 * fixture user with day-grain data containing three planted patterns —
 * a "Tuesday problem" in task completion, a fresh personal-best step day,
 * and a live above-median step streak — then drives
 * computeAndStoreInsights directly against the real database and asserts:
 *
 *   1. the planted patterns are detected and persisted (and the
 *      weekday finding names Tuesday specifically);
 *   2. a second run creates ZERO new rows (dedupe_key idempotency —
 *      the "run the cron twice, row count unchanged" check);
 *   3. no pattern detector fires on the metrics that were seeded flat
 *      (no manufactured insights).
 *
 * Same conventions as scripts/verify-health-metric-override.ts: fixture
 * user is disposable and cleaned up at the end (cascade delete removes
 * every seeded row plus the insights themselves).
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-insights.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { computeAndStoreInsights } from "@/domains/insights/service";
import { addDaysToDateString } from "@/domains/insights/dates";

const supabase = createScriptAdminClient();
const FIXTURE_EMAIL = "verify-insights-fixture@areta.local";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function createFixture(): Promise<string> {
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const leftover = userList?.users.find((u) => u.email === FIXTURE_EMAIL);
  if (leftover) await supabase.auth.admin.deleteUser(leftover.id);

  const { data, error } = await supabase.auth.admin.createUser({ email: FIXTURE_EMAIL, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const userId = data.user.id;

  const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, time_zone: "UTC" });
  if (profileError) throw new Error(`profiles upsert: ${profileError.message}`);
  return userId;
}

async function seedData(userId: string): Promise<void> {
  const today = todayUtc();
  const summaries = [];
  const actions = [];

  // 70 days of history ending today. Steps: ~6500 typical, a 15000-step
  // record YESTERDAY, and the last 5 days (incl. the record) all above
  // median for a live streak. Sleep: flat ~430min (weekend_shift and
  // sleep detectors must stay silent). Tasks: 4/day, Tuesdays complete 1,
  // every other day completes 4.
  for (let i = 0; i < 70; i++) {
    const day = addDaysToDateString(today, -(69 - i));
    const dayOfWeek = new Date(`${day}T00:00:00Z`).getUTCDay();
    const isYesterday = i === 68;
    const inStreakTail = i >= 65; // last 5 days incl. today
    // day_of_week / is_weekend are GENERATED columns — derived from `day`
    // by Postgres, not insertable.
    summaries.push({
      user_id: userId,
      day,
      timezone: "UTC",
      steps_total: isYesterday ? 15000 : inStreakTail ? 9000 + (i % 3) * 100 : 6000 + (i % 5) * 250,
      sleep_logged: true,
      sleep_total_duration_minutes: 425 + (i % 3) * 5,
      workout_count: 0,
      workout_total_minutes: 0,
    });

    const completes = dayOfWeek === 2 ? 1 : 4;
    for (let t = 0; t < 4; t++) {
      actions.push({
        user_id: userId,
        date: day,
        title: `Task ${t + 1}`,
        status: t < completes ? "completed" : "skipped",
      });
    }
  }

  const { error: summariesError } = await supabase.from("activity_daily_summaries").insert(summaries);
  if (summariesError) throw new Error(`summaries insert: ${summariesError.message}`);
  const { error: actionsError } = await supabase.from("daily_actions").insert(actions);
  if (actionsError) throw new Error(`actions insert: ${actionsError.message}`);
}

async function main() {
  const userId = await createFixture();
  console.log(`Fixture user created: ${userId}`);

  try {
    await seedData(userId);
    console.log("Seeded 70 days of summaries + tasks (Tuesday problem, fresh step record, live streak)");

    // 1. First run detects the planted patterns.
    const first = await computeAndStoreInsights(userId, supabase, { includePatternScans: true });
    const { data: rows } = await supabase
      .from("insights")
      .select("type, headline, facts, dedupe_key, score")
      .eq("user_id", userId)
      .order("score", { ascending: false });
    assert(rows && rows.length === first.created, "row count should match reported created count");

    const types = (rows ?? []).map((r) => r.type);
    assert(types.includes("weekday_pattern"), `expected weekday_pattern, got: ${types.join(", ")}`);
    const weekday = (rows ?? []).find((r) => r.type === "weekday_pattern");
    assert(
      (weekday?.facts as { dayOfWeek: number }).dayOfWeek === 2,
      "weekday_pattern should name Tuesday (dayOfWeek 2)"
    );
    assert(types.includes("personal_record"), `expected personal_record, got: ${types.join(", ")}`);
    assert(types.includes("behavior_streak"), `expected behavior_streak, got: ${types.join(", ")}`);
    // Planted-flat metrics must NOT fire — no manufactured insights.
    assert(!types.includes("weekend_shift"), "weekend_shift must not fire on flat sleep/steps");
    assert(!types.includes("workout_timing_sleep"), "workout_timing_sleep must not fire with zero workouts");
    console.log(`PASS: first run created ${first.created} insight(s):`);
    for (const row of rows ?? []) console.log(`  [${row.type}] ${row.headline}`);

    // 2. Idempotency: second run creates nothing new.
    const second = await computeAndStoreInsights(userId, supabase, { includePatternScans: true });
    assert(second.created === 0, `second run should create 0, created ${second.created}`);
    const { count } = await supabase
      .from("insights")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    assert(count === first.created, "row count must be unchanged after second run");
    console.log("PASS: second run created nothing (dedupe_key idempotency holds)");

    console.log("\nALL CHECKS PASSED");
  } finally {
    await supabase.auth.admin.deleteUser(userId);
    console.log("Fixture user deleted (cascade removed all seeded rows + insights)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
