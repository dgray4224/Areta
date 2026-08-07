import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { materializeCurrentMealWeek } from "@/domains/trainermealprogram/materialize";

/**
 * Weekly cron (see vercel.json), nutrition-side sibling of
 * regenerate-workout-plans: for every client with an *active*
 * trainer_meal_program_assignment, re-materializes their current week's
 * meal_plans/meal_plan_items. Every such client runs every time this
 * fires, regardless of whether their plan already looks current -- same
 * reasoning as the workout cron's own comment: a brand-new future-dated
 * assignment has no meal_plans row yet to ever look "stale," so it would
 * never get picked up otherwise once its start date arrives
 * (materializeCurrentMealWeek itself no-ops gracefully until then).
 *
 * Deliberately scoped to trainer-assigned clients only. Self-service
 * meal plans (domains/mealplan/service.ts#generateAndSaveMealPlan) have
 * no equivalent weekly-staleness cron of their own yet -- a pre-existing
 * gap, not something this route's scope covers (it mirrors the
 * workout cron's *trainer* half only, not its library half).
 *
 * Always writes straight to 'active' -- materializeCurrentMealWeek's own
 * doc comment explains why (the trainer-managed-client exception to
 * CLAUDE.md rule 10, same as the workout side).
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("trainer_meal_program_assignments")
    .select("client_id")
    .eq("status", "active");
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });

  const clientIds = Array.from(new Set((assignmentRows ?? []).map((row) => row.client_id)));

  const results = await Promise.allSettled(
    clientIds.map((clientId) => materializeCurrentMealWeek(clientId, supabase))
  );

  const generated = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failures: { clientId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push({ clientId: clientIds[i], error: String(r.reason) });
    } else if (!r.value.ok) {
      failures.push({ clientId: clientIds[i], error: r.value.error });
    }
  });

  return NextResponse.json({ checked: clientIds.length, generated, failures });
}
