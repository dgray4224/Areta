import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { generateAndSaveWorkoutPlan } from "@/domains/workoutplan/service";
import { generateAndSaveFromTrainerProgram } from "@/domains/trainerprogram/materialize";

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
 * creating a duplicate. generateAndSaveFromTrainerProgram (2026-08-06) is
 * the same shape for the trainer-program path and is naturally
 * idempotent too, now that it's a pure projection of (starts_on, phases,
 * overrides) rather than a stored pointer that advances.
 *
 * The two paths are found two different ways, not one shared "stale"
 * query: every user with an *active* trainer_program_assignment runs
 * every time this fires, regardless of whether they already have a
 * stale plan -- a brand-new future-dated assignment has no workout_plans
 * row yet to ever look "stale", so it would never get picked up
 * otherwise once its start date arrives (generateAndSaveFromTrainerProgram
 * itself is the one that no-ops gracefully until then). The library path
 * keeps the original stale-active-plan query, explicitly excluding
 * anyone with an active trainer program assignment -- generateAndSaveWorkoutPlan
 * itself refuses to run for them (see its own guard), so excluding them
 * here isn't just an optimization, it avoids every trainer-assigned
 * client showing up as a manufactured "failure" in the results below.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const weekStart = currentWeekStart();

  const [{ data: stalePlans, error: staleError }, { data: assignmentRows, error: assignmentError }] =
    await Promise.all([
      supabase.from("workout_plans").select("user_id").eq("status", "active").lt("week_start", weekStart),
      supabase.from("trainer_program_assignments").select("client_id").eq("status", "active"),
    ]);

  if (staleError) return NextResponse.json({ error: staleError.message }, { status: 500 });
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });

  const trainerAssignedIds = new Set((assignmentRows ?? []).map((row) => row.client_id));
  const libraryUserIds = Array.from(
    new Set((stalePlans ?? []).map((row) => row.user_id).filter((id) => !trainerAssignedIds.has(id)))
  );
  const trainerUserIds = Array.from(trainerAssignedIds);
  const userIds = [...libraryUserIds, ...trainerUserIds];

  const results = await Promise.allSettled([
    ...libraryUserIds.map((userId) => generateAndSaveWorkoutPlan(userId, undefined, supabase)),
    ...trainerUserIds.map((userId) => generateAndSaveFromTrainerProgram(userId, supabase)),
  ]);

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
