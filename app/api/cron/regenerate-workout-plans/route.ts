import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { ensureWorkoutPlanWeeksAhead } from "@/domains/workoutplan/service";
import { generateAndSaveFromTrainerProgram } from "@/domains/trainerprogram/materialize";
import { SELF_SERVICE_WEEKS_AHEAD } from "@/platform/ui/week-dates";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Weekly cron (see vercel.json): for every user whose *active* workout
 * plan's week_start has fallen behind the current week, keeps a rolling
 * `SELF_SERVICE_WEEKS_AHEAD`-week window (current + 3 more, "a month")
 * generated for library users, or re-materializes the current week for
 * trainer-program clients.
 *
 * Library (self-service) users: `ensureWorkoutPlanWeeksAhead` (2026-08-09)
 * auto-activates each week it generates directly, and never touches a
 * week that already has real content -- so a week the user already
 * customized ahead of time survives untouched even though this cron
 * checks all 4 weeks every time it fires. This is a deliberate policy
 * change from this route's original "never activates, CLAUDE.md rule 10
 * is non-negotiable" behavior -- found while investigating why the Plan
 * tab's calendar dots only ever showed for one week: this cron's old
 * draft-only output was never visible anywhere on mobile (no review/
 * approve screen exists there, only the web Workouts page's
 * ApproveWorkoutPlanButton), so a self-service mobile-only user's plan
 * silently never advanced past its first week -- and even once fixed to
 * auto-activate, only the current week was ever kept fresh, leaving a
 * user who shops multiple weeks ahead with nothing real to see or
 * customize past this week. Rule 10 governs generating *new*
 * parameters/plans from a stated outcome (the onboarding translation
 * pipeline) -- this is refreshing an *already-approved* plan's content
 * for upcoming weeks with the same approved parameters, and the user
 * explicitly chose auto-activate + an informational "what's new" banner
 * over a second approval gate for that case. The web app's manual
 * Generate/Approve button pair, onboarding's one-tap generate-and-approve,
 * and all trainer-assigned paths are untouched by this change.
 *
 * generateAndSaveWorkoutPlan's upsert (onConflict: user_id,week_start) on
 * workout_plans, which ensureWorkoutPlanWeeksAhead calls under the hood,
 * makes re-running this safe if the cron fires more than once for the
 * same week. generateAndSaveFromTrainerProgram (2026-08-06) is the same
 * shape for the trainer-program path and is naturally idempotent too, now
 * that it's a pure projection of (starts_on, phases, overrides) rather
 * than a stored pointer that advances.
 *
 * The two paths are found two different ways, not one shared "stale"
 * query: every user with an *active* trainer_program_assignment runs
 * every time this fires, regardless of whether they already have a
 * stale plan -- a brand-new future-dated assignment has no workout_plans
 * row yet to ever look "stale", so it would never get picked up
 * otherwise once its start date arrives (generateAndSaveFromTrainerProgram
 * itself is the one that no-ops gracefully until then). The library path
 * keeps the original stale-active-plan query (only used to decide *which*
 * users to run ensureWorkoutPlanWeeksAhead for, not how many weeks it
 * touches per user), explicitly excluding anyone with an active trainer
 * program assignment -- generateAndSaveWorkoutPlan itself refuses to run
 * for them (see its own guard), so excluding them here isn't just an
 * optimization, it avoids every trainer-assigned client showing up as a
 * manufactured "failure" in the results below.
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
    // ensureWorkoutPlanWeeksAhead resolves its own timezone-correct
    // todayForUser internally -- the UTC-based currentWeekStart() above is
    // only used for the staleness query that decides who to run this for.
    ...libraryUserIds.map((userId) => ensureWorkoutPlanWeeksAhead(userId, SELF_SERVICE_WEEKS_AHEAD, supabase)),
    ...trainerUserIds.map((userId) => generateAndSaveFromTrainerProgram(userId, supabase)),
  ]);

  const generated = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failures: { userId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push({ userId: userIds[i], error: String(r.reason) });
    } else if (!r.value.ok) {
      failures.push({ userId: userIds[i], error: r.value.error });
    }
  });

  return NextResponse.json({ checked: userIds.length, generated, failures });
}
