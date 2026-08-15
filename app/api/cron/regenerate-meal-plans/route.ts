import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { ensureMealPlanWeeksAhead } from "@/domains/mealplan/approve-flow";
import { SELF_SERVICE_WEEKS_AHEAD, weekStartFor } from "@/platform/ui/week-dates";

/** Normalized to the week's Sunday. Used below purely as the "anything
 * older than this is stale" cutoff -- with a raw current date, a plan
 * anchored earlier in the SAME week (which every legacy row is, see
 * weekStartFor) sorted below the cutoff and got treated as stale. */
function currentWeekStart(): string {
  return weekStartFor(new Date().toISOString().slice(0, 10));
}

/**
 * Weekly cron (see vercel.json), nutrition-side sibling of
 * regenerate-workout-plans: for every self-service (non-trainer) user
 * whose *active* meal plan's week_start has fallen behind the current
 * week, keeps a rolling `SELF_SERVICE_WEEKS_AHEAD`-week window (current +
 * 3 more, "a month") generated & auto-activated via `ensureMealPlanWeeksAhead`
 * (2026-08-09) -- never touching a week that already has real content, so
 * a week the user already customized ahead of time survives untouched.
 * See regenerate-workout-plans/route.ts's doc comment for the full
 * auto-activate rationale (same 2026-08-09 policy decision, applied
 * identically to both domains).
 *
 * Trainer-assigned clients are entirely out of scope for this cron
 * (2026-08-10, previously handled here via materializeCurrentMealWeek):
 * trainers are paid for customized nutrition programming, so generating a
 * client's plan must always be a deliberate manual action on the
 * trainer's side (see domains/trainer/service.ts), never automatic.
 * generateAndSaveMealPlan itself already refuses to run for anyone with
 * an active trainer_meal_program_assignment (see its own guard), but
 * they're still excluded from the candidate query up front so they don't
 * show up as manufactured "failures" in the results below. The web app's
 * manual Generate/Approve button pair and all other trainer-assigned
 * paths (materializeCurrentMealWeek et al.) are untouched by this change
 * -- trainers still have full manual control, this cron just no longer
 * drives it for them automatically.
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
  const userIds = Array.from(
    new Set((stalePlans ?? []).map((row) => row.user_id).filter((id) => !trainerAssignedIds.has(id)))
  );

  const results = await Promise.allSettled(
    // ensureMealPlanWeeksAhead resolves its own timezone-correct
    // todayForUser internally -- the UTC-based currentWeekStart() above is
    // only used for the staleness query that decides who to run this for.
    userIds.map((userId) => ensureMealPlanWeeksAhead(userId, SELF_SERVICE_WEEKS_AHEAD, supabase))
  );

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
