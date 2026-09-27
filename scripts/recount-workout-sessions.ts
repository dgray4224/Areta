/**
 * One-off repair: recount the workout fields of every stored weekly
 * review in sessions (training days) instead of exercises.
 *
 * Before 2026-09-27, computeWeeklyMetrics counted each workout_plan_items
 * row as a workout, but rows are exercises: a real 7-session week of 24
 * exercises was stored as "24 workouts planned" and the brief told its
 * owner the plan asked for 24 sessions. The code fix counts per day; this
 * rewrites the rows already stored, which the brief still reads (this
 * week's metrics, history, plan-execution streaks, achievements).
 *
 * Only the workout fields change: workoutsPlanned, workoutsCompleted,
 * workoutsAutoCompleted, workoutAdherencePercent, and the new
 * missedWorkoutDays. Rows whose week had no active plan are skipped.
 * Every change is printed before/after.
 *
 * Invoke: pnpm dlx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json scripts/recount-workout-sessions.ts [email] [--apply]
 * All users unless an email is given. Defaults to a dry run; pass --apply to write.
 */
import { createScriptAdminClient } from "./lib/admin-client";
import { computeWeeklyMetrics, type WeeklyMetrics } from "@/domains/review/metrics";
import type { Json } from "@/platform/db/types";

const WORKOUT_FIELDS = [
  "workoutsPlanned",
  "workoutsCompleted",
  "workoutsAutoCompleted",
  "workoutAdherencePercent",
  "missedWorkoutDays",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const supabase = createScriptAdminClient();

  let userId: string | undefined;
  if (email) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email === email)?.id;
    if (!userId) throw new Error(`No user with email ${email}`);
  }

  let query = supabase.from("weekly_reviews").select("id, user_id, week_start, metrics");
  if (userId) query = query.eq("user_id", userId);
  const { data: reviews, error } = await query;
  if (error) throw new Error(error.message);

  let changed = 0;
  for (const review of reviews ?? []) {
    const metrics = review.metrics as WeeklyMetrics | null;
    if (!metrics?.weekStart) continue;

    const { data: items } = await supabase
      .from("workout_plan_items")
      .select("day_of_week, completed_at, completed_source, workout_plans!inner(week_start, status)")
      .eq("user_id", review.user_id)
      .eq("workout_plans.week_start", metrics.weekStart)
      .eq("workout_plans.status", "active");
    if (!items || items.length === 0) continue;

    const recount = computeWeeklyMetrics({
      weekStart: metrics.weekStart,
      weightLogs: [],
      sleepLogs: [],
      nutritionLogs: [],
      recoveryLogs: [],
      studySessions: [],
      tasks: [],
      calorieTarget: null,
      proteinTarget: null,
      restingHeartRateLogs: [],
      heartRateVariabilityLogs: [],
      vo2MaxLogs: [],
      plannedWorkouts: items.map((i) => ({
        dayOfWeek: i.day_of_week,
        completedAt: i.completed_at,
        completedSource: i.completed_source,
      })),
    });

    const before = Object.fromEntries(WORKOUT_FIELDS.map((f) => [f, metrics[f] ?? null]));
    const after = Object.fromEntries(WORKOUT_FIELDS.map((f) => [f, recount[f] ?? null]));
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    changed++;
    console.log(`${review.user_id} week ${review.week_start}:`);
    console.log(`  before ${JSON.stringify(before)}`);
    console.log(`  after  ${JSON.stringify(after)}`);

    if (apply) {
      const { error: updateError } = await supabase
        .from("weekly_reviews")
        .update({ metrics: { ...metrics, ...after } as unknown as Json })
        .eq("id", review.id);
      if (updateError) console.error(`  FAILED: ${updateError.message}`);
    }
  }

  console.log(`\n${changed} review(s) ${apply ? "updated" : "would change (dry run; pass --apply to write)"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
