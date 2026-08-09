import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { materializeCurrentMealWeek } from "@/domains/trainermealprogram/materialize";
import { generateAndSaveMealPlan } from "@/domains/mealplan/service";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Weekly cron (see vercel.json), nutrition-side sibling of
 * regenerate-workout-plans.
 *
 * Trainer-assigned clients (*active* trainer_meal_program_assignment):
 * re-materializes their current week's meal_plans/meal_plan_items every
 * time this fires, regardless of whether their plan already looks current
 * -- a brand-new future-dated assignment has no meal_plans row yet to
 * ever look "stale," so it would never get picked up otherwise once its
 * start date arrives (materializeCurrentMealWeek itself no-ops
 * gracefully until then). Always writes straight to 'active' --
 * materializeCurrentMealWeek's own doc comment explains why (the
 * trainer-managed-client exception to CLAUDE.md rule 10).
 *
 * Library (self-service) users (2026-08-09, closes a real gap -- this
 * route used to be scoped to trainer-assigned clients only, meaning
 * self-service meal plans had *no* weekly regeneration at all): mirrors
 * the workout cron's stale-active-plan query, and like that cron's
 * library half now also auto-activates directly
 * (`activateImmediately: true`) rather than leaving an unapproved draft
 * -- see regenerate-workout-plans/route.ts's doc comment for the full
 * rationale (same 2026-08-09 policy decision, applied identically to
 * both domains).
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
      supabase.from("meal_plans").select("user_id").eq("status", "active").lt("week_start", weekStart),
      supabase.from("trainer_meal_program_assignments").select("client_id").eq("status", "active"),
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
    // weekStart intentionally omitted here (not the UTC-based
    // currentWeekStart() above, only used for the staleness query) --
    // generateAndSaveMealPlan resolves its own timezone-correct
    // todayForUser internally when omitted.
    ...libraryUserIds.map((userId) => generateAndSaveMealPlan(userId, { activateImmediately: true }, supabase)),
    ...trainerUserIds.map((clientId) => materializeCurrentMealWeek(clientId, supabase)),
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
