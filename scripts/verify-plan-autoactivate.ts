/**
 * E2E verification for the 2026-08-09 self-service plan auto-activation
 * change (domains/workoutplan/service.ts + domains/mealplan/service.ts's
 * new `activateImmediately` option; app/api/cron/regenerate-workout-plans
 * + regenerate-meal-plans/route.ts passing it for library users;
 * domains/mealplan/customize.ts + workoutplan/customize.ts's
 * bootstrap-if-missing doing the same). Same throwaway-fixture-user
 * pattern as scripts/verify-weekly-customization.ts -- real DB, real
 * domain functions, fixtures deleted afterward.
 *
 * Covers, in order:
 *  1. A stale 'active' meal_plans/workout_plans row (simulating a plan
 *     that fell behind, exactly what the crons' staleness query finds)
 *     regenerated with `activateImmediately: true` (as the crons now do)
 *     lands directly `status: 'active'`, with a fresh `updated_at`.
 *  2. Omitting `activateImmediately` (every other existing caller) still
 *     lands `status: 'draft'` -- proves the default is unchanged, not a
 *     silent behavior flip for the web Generate button/onboarding/etc.
 *  3. domains/mealplan/customize.ts#assignMealPlanDays and
 *     domains/workoutplan/customize.ts#assignWorkoutPlanExerciseDays,
 *     called on a FUTURE week with no existing plan, bootstrap directly
 *     to 'active' (closes the same invisible-draft gap for the
 *     customize flow, not just the passive cron).
 *
 * The trainer-assignment guard in both generateAndSave* functions runs
 * strictly before `activateImmediately` is ever read (same lines,
 * untouched by this change) -- not re-verified here with a full
 * trainer-program fixture, since there is no code path by which the new
 * param could reach or bypass that earlier return.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-plan-autoactivate.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";

const supabase = createScriptAdminClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

/** The Sunday-aligned week start for a UTC instant, N weeks from now. */
function weekStartOffset(weeksFromNow: number): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - now.getUTCDay() + weeksFromNow * 7);
  return sunday.toISOString().slice(0, 10);
}

async function createFixtureUser(email: string): Promise<string> {
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const leftover = userList?.users.find((u) => u.email === email);
  if (leftover) await supabase.auth.admin.deleteUser(leftover.id);

  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  return data.user.id;
}

/** Goal-first onboarding shape -- same as verify-weekly-customization.ts's
 * fixture, gives a workout plan with program_phase_id null so the
 * legacy-shape assignWorkoutPlanExerciseDays path is reachable in
 * scenario 3. */
async function seedOnboarding(userId: string): Promise<void> {
  const responses = {
    user_id: userId,
    identity: {
      fullName: "Plan Autoactivate Fixture",
      timeZone: "America/New_York",
      units: "imperial",
      wakeTime: "07:00",
      bedTime: "23:00",
      weeklyReviewDay: 0,
      groceryDay: 6,
      mealPrepDay: 0,
    },
    goals: [],
    nutrition: {
      height: 70,
      currentWeight: 190,
      targetWeight: 180,
      age: 30,
      sex: "male",
      activityLevel: "moderate",
      mealsPerDay: 3,
      trackingPreference: "simple",
    },
    exercise: {
      primaryGoal: "lose_fat",
      recentExperience: "consistent",
      daysPerWeek: "4",
      sessionDurationBand: "45",
      trainingLocation: "full_gym",
      equipmentAccess: ["Full gym access"],
      injuryStatus: "no",
    },
    completed_steps: ["identity", "goals", "nutrition", "exercise"],
  };
  const { error } = await supabase.from("onboarding_responses").upsert(responses as never);
  if (error) throw new Error(`onboarding_responses: ${error.message}`);
}

async function seedApprovedSessionsPerWeek(userId: string): Promise<void> {
  const { error } = await supabase.from("generated_parameters").upsert(
    {
      user_id: userId,
      domain: "exercise",
      name: "sessions_per_week",
      value: 4,
      source: "calculation",
      rationale: "Fixture-seeded for scripts/verify-plan-autoactivate.ts",
      confidence: 1,
      requires_user_approval: false,
      requires_professional_approval: false,
      approved: true,
      approved_at: new Date().toISOString(),
    },
    { onConflict: "user_id,domain,name" }
  );
  if (error) throw new Error(`generated_parameters (sessions_per_week): ${error.message}`);
}

async function seedApprovedNutritionParams(userId: string): Promise<void> {
  const rows = [
    { name: "calorie_target", value: 2200 },
    { name: "protein_target_g", value: 160 },
  ];
  for (const row of rows) {
    const { error } = await supabase.from("generated_parameters").upsert(
      {
        user_id: userId,
        domain: "nutrition",
        name: row.name,
        value: row.value,
        source: "calculation",
        rationale: "Fixture-seeded for scripts/verify-plan-autoactivate.ts",
        confidence: 1,
        requires_user_approval: false,
        requires_professional_approval: false,
        approved: true,
        approved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,domain,name" }
    );
    if (error) throw new Error(`generated_parameters (${row.name}): ${error.message}`);
  }
}

/** Simulates "an already-active plan that's fallen behind" -- exactly
 * what the crons' `.eq("status","active").lt("week_start", weekStart)`
 * staleness query finds. Minimal row, no items -- only status/week_start
 * matter for this script's assertions. */
async function seedStaleActivePlan(table: "meal_plans" | "workout_plans", userId: string): Promise<void> {
  const staleWeekStart = weekStartOffset(-2);
  const base =
    table === "meal_plans"
      ? { calorie_target: 2000, protein_target: 150 }
      : { sessions_per_week: 4 };
  const { error } = await supabase
    .from(table)
    .upsert({ user_id: userId, week_start: staleWeekStart, status: "active", ...base }, { onConflict: "user_id,week_start" });
  if (error) throw new Error(`seedStaleActivePlan(${table}): ${error.message}`);
}

async function main() {
  const { generateAndSaveMealPlan, getMealPlanForWeek } = await import("@/domains/mealplan/service");
  const { generateAndSaveWorkoutPlan, getWorkoutPlanForWeek } = await import("@/domains/workoutplan/service");
  const { assignMealPlanDays } = await import("@/domains/mealplan/customize");
  const { assignWorkoutPlanExerciseDays } = await import("@/domains/workoutplan/customize");

  const fixtureIds: string[] = [];
  try {
    const userId = await createFixtureUser("verify-plan-autoactivate-fixture@areta.local");
    fixtureIds.push(userId);
    await seedOnboarding(userId);
    await seedApprovedSessionsPerWeek(userId);
    await seedApprovedNutritionParams(userId);
    console.log(`Fixture user created: ${userId}`);

    const currentWeek = weekStartOffset(0);
    const futureWeek = weekStartOffset(3);

    // --- Scenario 1: activateImmediately mirrors what the crons now do ---
    await seedStaleActivePlan("meal_plans", userId);
    const beforeMeal = new Date().toISOString();
    const mealResult = await generateAndSaveMealPlan(userId, { weekStart: currentWeek, activateImmediately: true }, supabase);
    assert(mealResult.ok, `generateAndSaveMealPlan (activateImmediately) failed: ${!mealResult.ok ? mealResult.error : ""}`);
    const activatedMealPlan = await getMealPlanForWeek(userId, currentWeek, supabase);
    assert(activatedMealPlan !== null, "Expected a meal plan for the current week after generation.");
    assert(activatedMealPlan.status === "active", `Expected status "active", got "${activatedMealPlan.status}"`);
    assert(
      activatedMealPlan.updatedAt >= beforeMeal,
      `Expected a fresh updated_at (>= ${beforeMeal}), got ${activatedMealPlan.updatedAt}`
    );
    console.log("PASS: generateAndSaveMealPlan(activateImmediately: true) writes status 'active' directly, with a fresh updatedAt.");

    await seedStaleActivePlan("workout_plans", userId);
    const workoutResult = await generateAndSaveWorkoutPlan(userId, { weekStart: currentWeek, activateImmediately: true }, supabase);
    assert(workoutResult.ok, `generateAndSaveWorkoutPlan (activateImmediately) failed: ${!workoutResult.ok ? workoutResult.error : ""}`);
    const activatedWorkoutPlan = await getWorkoutPlanForWeek(userId, currentWeek, supabase);
    assert(activatedWorkoutPlan !== null, "Expected a workout plan for the current week after generation.");
    assert(activatedWorkoutPlan.status === "active", `Expected status "active", got "${activatedWorkoutPlan.status}"`);
    console.log("PASS: generateAndSaveWorkoutPlan(activateImmediately: true) writes status 'active' directly.");

    // --- Scenario 2: default (omitted) behavior is unchanged -- still drafts ---
    const draftWeek = weekStartOffset(1);
    const defaultMealResult = await generateAndSaveMealPlan(userId, { weekStart: draftWeek }, supabase);
    assert(defaultMealResult.ok, `generateAndSaveMealPlan (default) failed: ${!defaultMealResult.ok ? defaultMealResult.error : ""}`);
    const defaultMealPlan = await getMealPlanForWeek(userId, draftWeek, supabase);
    assert(defaultMealPlan?.status === "draft", `Expected default status "draft", got "${defaultMealPlan?.status}"`);

    const defaultWorkoutResult = await generateAndSaveWorkoutPlan(userId, { weekStart: draftWeek }, supabase);
    assert(defaultWorkoutResult.ok, `generateAndSaveWorkoutPlan (default) failed: ${!defaultWorkoutResult.ok ? defaultWorkoutResult.error : ""}`);
    const defaultWorkoutPlan = await getWorkoutPlanForWeek(userId, draftWeek, supabase);
    assert(defaultWorkoutPlan?.status === "draft", `Expected default status "draft", got "${defaultWorkoutPlan?.status}"`);
    console.log("PASS: omitting activateImmediately still lands 'draft' -- default behavior unchanged for every other caller.");

    // --- Scenario 3: customize.ts bootstrap-if-missing also auto-activates ---
    const { data: recipeRow, error: recipeError } = await supabase
      .from("recipes")
      .select("id, meal_type")
      .eq("status", "active")
      .eq("meal_type", "breakfast")
      .limit(1)
      .single();
    if (recipeError || !recipeRow) throw new Error(`Failed to find a fixture recipe: ${recipeError?.message}`);

    const assignMealResult = await assignMealPlanDays(
      userId,
      { weekStart: futureWeek, recipeId: recipeRow.id, mealType: "breakfast", daysOfWeek: [1] },
      supabase
    );
    assert(assignMealResult.ok, `assignMealPlanDays (bootstrap) failed: ${!assignMealResult.ok ? assignMealResult.error : ""}`);
    const bootstrappedMealPlan = await getMealPlanForWeek(userId, futureWeek, supabase);
    assert(
      bootstrappedMealPlan?.status === "active",
      `Expected assignMealPlanDays's bootstrap to land 'active', got "${bootstrappedMealPlan?.status}"`
    );
    console.log("PASS: assignMealPlanDays's bootstrap-if-missing on a future week lands 'active' directly.");

    const { data: exerciseRow, error: exerciseError } = await supabase.from("exercises").select("id").limit(1).single();
    if (exerciseError || !exerciseRow) throw new Error(`Failed to find a fixture exercise: ${exerciseError?.message}`);

    const assignExerciseResult = await assignWorkoutPlanExerciseDays(
      userId,
      futureWeek,
      { exerciseId: exerciseRow.id, sets: 3, reps: 10, durationMinutes: null },
      [2],
      supabase
    );
    assert(
      assignExerciseResult.ok,
      `assignWorkoutPlanExerciseDays (bootstrap) failed: ${!assignExerciseResult.ok ? assignExerciseResult.error : ""}`
    );
    const bootstrappedWorkoutPlan = await getWorkoutPlanForWeek(userId, futureWeek, supabase);
    assert(
      bootstrappedWorkoutPlan?.status === "active",
      `Expected assignWorkoutPlanExerciseDays's bootstrap to land 'active', got "${bootstrappedWorkoutPlan?.status}"`
    );
    console.log("PASS: assignWorkoutPlanExerciseDays's bootstrap-if-missing on a future week lands 'active' directly.");

    console.log("\nAll assertions passed.");
  } finally {
    for (const id of fixtureIds) {
      await supabase.auth.admin.deleteUser(id);
      console.log(`Cleaned up fixture user ${id}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
