import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { generateAndSaveWorkoutPlan } from "@/domains/workoutplan/service";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Weekly cron (see vercel.json): for every user whose *active* workout
 * plan's week_start has fallen behind the current week, generates a fresh
 * DRAFT for the current week -- never activates it. CLAUDE.md rule 10
 * ("require approval before changing active plans") is non-negotiable, so
 * this job only makes sure a reviewable draft is waiting; the user's
 * active plan keeps serving exactly what it served before until they
 * approve the draft on the web Workouts page. Without this job, a user
 * could otherwise be stuck replaying an arbitrarily stale plan
 * indefinitely, since generateAndSaveWorkoutPlan previously only ran from
 * a manual button click.
 *
 * generateAndSaveWorkoutPlan's upsert (onConflict: user_id,week_start) on
 * workout_plans makes re-running this safe if the cron fires more than
 * once for the same week -- it overwrites the same draft row rather than
 * creating a duplicate.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const weekStart = currentWeekStart();

  const { data: stalePlans, error } = await supabase
    .from("workout_plans")
    .select("user_id")
    .eq("status", "active")
    .lt("week_start", weekStart);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((stalePlans ?? []).map((row) => row.user_id)));
  const results = await Promise.allSettled(userIds.map((userId) => generateAndSaveWorkoutPlan(userId, supabase)));

  const draftsGenerated = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failures: { userId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push({ userId: userIds[i], error: String(r.reason) });
    } else if (!r.value.ok) {
      failures.push({ userId: userIds[i], error: r.value.error });
    }
  });

  return NextResponse.json({ checked: userIds.length, draftsGenerated, failures });
}
