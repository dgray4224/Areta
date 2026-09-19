import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { sendOpsAlert } from "@/platform/alerts/notify";
import { assumePlannedMealsForUser } from "@/domains/mealplan/assume-meals-service";

/**
 * Nightly: treat yesterday's planned meals as eaten unless the person
 * said otherwise.
 *
 * Once a day is enough, despite "the day is over" landing at a different
 * moment in every timezone. assumePlannedMealsForUser works from each
 * user's own local date and only touches days strictly before it, so at
 * any instant "yesterday, where they are" is a finished day — whatever
 * hour this fires. The three-day lookback absorbs the rest.
 *
 * (It was hourly for one commit, on the theory that timezones needed it.
 * They don't, the per-user local date already handles it, and hourly is
 * rejected outright on a Vercel Hobby plan — which silently failed every
 * deployment for six commits until someone read the deploy log rather
 * than the endpoint.)
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
