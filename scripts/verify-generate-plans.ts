/**
 * E2E verification for the post-onboarding one-tap plan setup
 * (domains/onboarding/generate-plans.ts): seeds a throwaway fixture
 * user with a complete consolidated onboarding (identity/goals/
 * nutrition/exercise), runs the REAL generatePlansAfterOnboarding
 * cascade, asserts both plans landed ACTIVE (params approved, meal plan
 * + grocery + prep, workout plan), then also checks getPlanReadiness's
 * missing-input reporting on an empty user. Cleans up afterwards.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-generate-plans.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";

const supabase = createScriptAdminClient();

type GeneratePlansModule = typeof import("@/domains/onboarding/generate-plans");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function createFixture(email: string, complete: boolean): Promise<string> {
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const leftover = userList?.users.find((u) => u.email === email);
  if (leftover) await supabase.auth.admin.deleteUser(leftover.id);

  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const userId = data.user.id;

  const responses = complete
    ? {
        user_id: userId,
        identity: {
          fullName: "Plan Popup Fixture",
          timeZone: "America/New_York",
          units: "imperial",
          wakeTime: "07:00",
          bedTime: "23:00",
          weeklyReviewDay: "sunday",
          groceryDay: "saturday",
          mealPrepDay: "sunday",
        },
        goals: [],
        nutrition: {
          height: 70,
          currentWeight: 200,
          targetWeight: 185,
          age: 30,
          sex: "male",
          activityLevel: "moderate",
          mealsPerDay: 3,
          trackingPreference: "simple",
        },
        exercise: {
          primaryGoal: "lose_fat",
          recentExperience: "consistent",
          daysPerWeek: "3",
          sessionDurationBand: "45",
          trainingLocation: "full_gym",
          equipmentAccess: ["Full gym access"],
          injuryStatus: "no",
        },
        completed_steps: ["identity", "goals", "nutrition", "exercise"],
      }
    : { user_id: userId, completed_steps: [] };

  const { error: onboardingError } = await supabase.from("onboarding_responses").upsert(responses as never);
  if (onboardingError) throw new Error(`onboarding_responses: ${onboardingError.message}`);
  return userId;
}

async function main() {
  const { generatePlansAfterOnboarding, getPlanReadiness }: GeneratePlansModule = await import(
    "@/domains/onboarding/generate-plans"
  );

  const fixtureIds: string[] = [];
  try {
    // --- Scenario 1: complete onboarding (goals skipped!), full cascade
    console.log("=== complete onboarding (goals skipped) -> full cascade ===");
    const userId = await createFixture("plan-popup-fixture@areta.local", true);
    fixtureIds.push(userId);

    const readiness = await getPlanReadiness(userId, supabase);
    console.log("readiness:", JSON.stringify(readiness));
    assert(readiness.nutrition.ready, "nutrition ready");
    assert(readiness.workout.ready, "workout ready");

    const result = await generatePlansAfterOnboarding(userId, supabase);
    console.log("result:", JSON.stringify(result));
    assert(result.nutrition.ok, `nutrition chain ok (${result.nutrition.error ?? ""})`);
    assert(result.workout.ok, `workout chain ok (${result.workout.error ?? ""})`);

    const [{ data: mealPlan }, { data: workoutPlan }, { data: grocery }, { data: prep }, { data: params }] =
      await Promise.all([
        supabase.from("meal_plans").select("status").eq("user_id", userId).single(),
        supabase.from("workout_plans").select("status, template_id").eq("user_id", userId).single(),
        supabase.from("grocery_lists").select("id").eq("user_id", userId).maybeSingle(),
        supabase.from("prep_plans").select("id").eq("user_id", userId).maybeSingle(),
        supabase.from("generated_parameters").select("domain, approved").eq("user_id", userId),
      ]);
    assert(mealPlan?.status === "active", `meal plan active (got ${mealPlan?.status})`);
    assert(workoutPlan?.status === "active", `workout plan active (got ${workoutPlan?.status})`);
    assert(workoutPlan?.template_id, "workout plan came from the goal-first engine");
    assert(grocery, "grocery list generated");
    assert(prep, "prep plan generated");
    assert((params ?? []).length > 0 && params!.every((p) => p.approved), "all parameters approved");
    console.log(`PASS — meal plan active, workout plan active (template engine), grocery+prep exist, ${params!.length} params approved`);

    // --- Scenario 2: empty onboarding -> readiness reports what's missing
    console.log("\n=== empty onboarding -> readiness reports missing inputs ===");
    const emptyId = await createFixture("plan-popup-empty-fixture@areta.local", false);
    fixtureIds.push(emptyId);
    const emptyReadiness = await getPlanReadiness(emptyId, supabase);
    console.log("readiness:", JSON.stringify(emptyReadiness));
    assert(!emptyReadiness.nutrition.ready && emptyReadiness.nutrition.missingInputs.length > 0, "nutrition not ready with reasons");
    assert(!emptyReadiness.workout.ready && emptyReadiness.workout.missingInputs.length > 0, "workout not ready with reasons");
    console.log("PASS");
  } finally {
    for (const id of fixtureIds) await supabase.auth.admin.deleteUser(id);
    console.log(`\nCleaned up ${fixtureIds.length} fixture users.`);
  }
  console.log("\nAll scenarios passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
