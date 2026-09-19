import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { sendOpsAlert } from "@/platform/alerts/notify";
import { assumePlannedMealsForUser } from "@/domains/mealplan/assume-meals-service";

/**
 * Nightly: treat yesterday's planned meals as eaten unless the person
 * said otherwise.
 *
 * Runs hourly rather than once a day because "the day is over" happens
 * at a different moment in every timezone, and assumePlannedMealsForUser
 * decides per user from their own local date. An hour that is the middle
 * of the night for nobody simply assumes nothing, and the pass is
 * idempotent, so running it 24 times a day is the cheap way to be right
 * everywhere instead of right in one timezone.
 *
 * Only users with meal planning switched on: someone training-only has
 * no meals to assume, and writing them intake they never planned would
 * be inventing data outright.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .not("onboarding_completed_at", "is", null)
    .neq("meal_planning_enabled", false);

  if (error) {
    await sendOpsAlert({ subject: "Meal assumption pass could not run", detail: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let assumed = 0;
  let usersTouched = 0;
  for (const profile of profiles ?? []) {
    const result = await assumePlannedMealsForUser(profile.id, supabase);
    if (result.assumed > 0) {
      assumed += result.assumed;
      usersTouched += 1;
    }
  }

  return NextResponse.json({ checked: profiles?.length ?? 0, usersTouched, assumed });
}
