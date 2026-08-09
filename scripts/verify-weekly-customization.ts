/**
 * End-to-end verification for the weekly meal/workout customization
 * feature (domains/mealplan/customize.ts, domains/workoutplan/
 * customize.ts, domains/grocery/service.ts#getConsolidatedGroceryList,
 * the pick-history tables). Same throwaway-fixture-user pattern as
 * scripts/verify-generate-plans.ts/verify-goalfirst-engine.ts -- real
 * DB, real domain functions, fixtures deleted afterward.
 *
 * Covers, in order:
 *  1. assignMealPlanDays bootstraps a missing week, targets exactly the
 *     requested slots, and leaves other slots algorithm-filled.
 *  2. A second call to a different slot in the SAME week doesn't wipe
 *     the first call's pick (the destructive-regen bug this feature
 *     exists to avoid).
 *  3. meal_pick_history gets exactly one row per day assigned.
 *  4. Editing an already-approved week (has a materialized grocery
 *     list) refreshes that grocery list for that specific week.
 *  5. getConsolidatedGroceryList actually merges across weeks (not just
 *     echoing one week), and reports a week with no plan in
 *     weeksMissingPlan.
 *  6. assignWorkoutPlanSessionDays (program-based fixture): assigned
 *     days' items match the session's exercises; exercise_pick_history
 *     written.
 *  7. assignWorkoutPlanExerciseDays (goal-first fixture, no session
 *     concept): a day's pre-existing algorithm items are replaced once,
 *     then appended to (not re-wiped) on a second call to the same day.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-weekly-customization.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";

const supabase = createScriptAdminClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Sunday-aligned week start for a UTC instant, N weeks from now. */
function futureWeekStart(weeksFromNow: number): string {
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

/** Goal-first onboarding shape (primaryGoal set, no archetype) -- same
 * fixture data shape verify-generate-plans.ts's "complete" scenario
 * uses. Produces a goal-first workout plan (program_phase_id null) once
 * generateAndSaveWorkoutPlan runs, which doubles as this script's
 * legacy/no-session-concept workout fixture (scenario 7) -- no need for
 * a third fixture user. */
async function seedGoalFirstOnboarding(userId: string): Promise<void> {
  const responses = {
    user_id: userId,
    identity: {
      fullName: "Weekly Customization Fixture",
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
  if (error) throw new Error(`onboarding_responses (goal-first): ${error.message}`);
}

/** Legacy archetype shape (archetype set, no primaryGoal -- see
 * isLegacyExerciseShape) + a directly-inserted approved sessions_per_week
 * parameter (bypassing the normal generate-then-approve UI flow, same
 * shortcut scripts/dev-generate-founder-plan.ts documents reading). This
 * is what routes generateAndSaveWorkoutPlan through the real
 * training_programs pipeline, giving a program_phase_id-bearing plan --
 * scenario 6's fixture. */
async function seedLegacyArchetypeOnboarding(userId: string): Promise<void> {
  const responses = {
    user_id: userId,
    identity: {
      fullName: "Weekly Customization Fixture (Legacy)",
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
      height: 68,
      currentWeight: 160,
      targetWeight: 155,
      age: 28,
      sex: "female",
      activityLevel: "moderate",
      mealsPerDay: 3,
      trackingPreference: "simple",
    },
    exercise: {
      archetype: "general_fitness",
      equipmentAccess: ["Bodyweight only", "Dumbbells"],
      experienceLevel: "beginner",
    },
    completed_steps: ["identity", "goals", "nutrition", "exercise"],
  };
  const { error: onboardingError } = await supabase.from("onboarding_responses").upsert(responses as never);
  if (onboardingError) throw new Error(`onboarding_responses (legacy): ${onboardingError.message}`);

  await seedApprovedSessionsPerWeek(userId);
}

/** generateAndSaveWorkoutPlan requires an approved exercise/sessions_per_week
 * parameter regardless of legacy vs. goal-first shape (checked before the
 * branch) -- both workout fixtures need this, not just the legacy one. */
async function seedApprovedSessionsPerWeek(userId: string): Promise<void> {
  const { error } = await supabase.from("generated_parameters").upsert(
    {
      user_id: userId,
      domain: "exercise",
      name: "sessions_per_week",
      value: 4,
      source: "calculation",
      rationale: "Fixture-seeded for scripts/verify-weekly-customization.ts",
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
        rationale: "Fixture-seeded for scripts/verify-weekly-customization.ts",
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

async function main() {
  const { assignMealPlanDays } = await import("@/domains/mealplan/customize");
  const { getMealPlanForWeek } = await import("@/domains/mealplan/service");
  const { generateAndSaveGroceryList, getConsolidatedGroceryList } = await import("@/domains/grocery/service");
  const { assignWorkoutPlanSessionDays, assignWorkoutPlanExerciseDays } = await import("@/domains/workoutplan/customize");
  const { generateAndSaveWorkoutPlan } = await import("@/domains/workoutplan/service");

  const fixtureIds: string[] = [];
  try {
    // ================= Meal day-assignment (scenarios 1-4) =================
    console.log("=== Meal day-assignment ===");
    const mealUserId = await createFixtureUser("weekly-custom-meal@areta.local");
    fixtureIds.push(mealUserId);
    await seedGoalFirstOnboarding(mealUserId);
    await seedApprovedNutritionParams(mealUserId);

    const week1 = futureWeekStart(3); // a future week with no plan yet
    const { data: breakfastRecipe } = await supabase
      .from("recipes")
      .select("id")
      .eq("status", "active")
      .eq("meal_type", "breakfast")
      .limit(1)
      .single();
    assert(breakfastRecipe, "seeded recipe library has an active breakfast recipe");

    const assign1 = await assignMealPlanDays(
      mealUserId,
      { weekStart: week1, recipeId: breakfastRecipe.id, mealType: "breakfast", daysOfWeek: [1, 3, 5] },
      supabase
    );
    assert(assign1.ok, `first assignMealPlanDays ok (${!assign1.ok ? assign1.error : ""})`);

    const planAfter1 = await getMealPlanForWeek(mealUserId, week1, supabase);
    assert(planAfter1 !== null, "week bootstrapped by assignMealPlanDays");
    const mon = planAfter1!.items.find((i) => i.dayOfWeek === 1 && i.mealType === "breakfast");
    const wed = planAfter1!.items.find((i) => i.dayOfWeek === 3 && i.mealType === "breakfast");
    const fri = planAfter1!.items.find((i) => i.dayOfWeek === 5 && i.mealType === "breakfast");
    assert(mon?.recipeId === breakfastRecipe.id && wed?.recipeId === breakfastRecipe.id && fri?.recipeId === breakfastRecipe.id, "requested days got the assigned recipe");
    const tue = planAfter1!.items.find((i) => i.dayOfWeek === 2 && i.mealType === "breakfast");
    assert(tue !== undefined, "untouched day (Tuesday breakfast) was still algorithm-filled, not left blank");
    console.log(`PASS -- bootstrap + assignment landed on Mon/Wed/Fri, Tue auto-filled (${tue!.recipeId})`);

    const { data: lunchRecipe } = await supabase.from("recipes").select("id").eq("status", "active").eq("meal_type", "lunch").limit(1).single();
    assert(lunchRecipe, "seeded recipe library has an active lunch recipe");
    const assign2 = await assignMealPlanDays(
      mealUserId,
      { weekStart: week1, recipeId: lunchRecipe.id, mealType: "lunch", daysOfWeek: [2, 4] },
      supabase
    );
    assert(assign2.ok, `second assignMealPlanDays ok (${!assign2.ok ? assign2.error : ""})`);

    const planAfter2 = await getMealPlanForWeek(mealUserId, week1, supabase);
    const monAfter2 = planAfter2!.items.find((i) => i.dayOfWeek === 1 && i.mealType === "breakfast");
    assert(monAfter2?.recipeId === breakfastRecipe.id, "first call's Monday breakfast pick survived the second call (no destructive regen)");
    console.log("PASS -- second call to a different slot did not wipe the first call's pick");

    const { data: pickHistory } = await supabase
      .from("meal_pick_history")
      .select("day_of_week, meal_type")
      .eq("user_id", mealUserId)
      .eq("week_start", week1);
    assert(pickHistory?.length === 5, `meal_pick_history has 5 rows (3 breakfast + 2 lunch), got ${pickHistory?.length}`);
    console.log("PASS -- meal_pick_history has exactly one row per day assigned");

    // Scenario 4: editing an already-"approved" week refreshes its grocery list.
    await supabase.from("meal_plans").update({ status: "active" }).eq("user_id", mealUserId).eq("week_start", week1);
    const groceryGen = await generateAndSaveGroceryList(mealUserId, supabase, week1);
    assert(groceryGen.ok, `initial grocery generation for week1 ok (${!groceryGen.ok ? groceryGen.error : ""})`);

    const { data: dinnerRecipe } = await supabase.from("recipes").select("id, name").eq("status", "active").eq("meal_type", "dinner").limit(1).single();
    assert(dinnerRecipe, "seeded recipe library has an active dinner recipe");
    const assign3 = await assignMealPlanDays(mealUserId, { weekStart: week1, recipeId: dinnerRecipe.id, mealType: "dinner", daysOfWeek: [0] }, supabase);
    assert(assign3.ok, `third assignMealPlanDays (already-approved week) ok (${!assign3.ok ? assign3.error : ""})`);

    const { data: groceryList } = await supabase.from("grocery_lists").select("id").eq("user_id", mealUserId).eq("week_start", week1).single();
    const { data: groceryItems } = await supabase.from("grocery_items").select("needed_for").eq("grocery_list_id", groceryList!.id);
    const mentionsNewDinner = (groceryItems ?? []).some((i) => (i.needed_for as string[]).includes(dinnerRecipe.name));
    assert(mentionsNewDinner, `grocery list for week1 was refreshed to include the newly-assigned dinner recipe ("${dinnerRecipe.name}")`);
    console.log("PASS -- assignMealPlanDays refreshed the already-approved week's grocery list, targeting the correct week");

    // ================= Grocery consolidation (scenario 5) =================
    console.log("\n=== Grocery consolidation ===");
    const week2 = addDaysStr(week1, 7);
    const week3 = addDaysStr(week1, 14); // left untouched -- should land in weeksMissingPlan
    const assignWeek2 = await assignMealPlanDays(mealUserId, { weekStart: week2, recipeId: breakfastRecipe.id, mealType: "breakfast", daysOfWeek: [1] }, supabase);
    assert(assignWeek2.ok, `bootstrapping week2 via assignMealPlanDays ok (${!assignWeek2.ok ? assignWeek2.error : ""})`);

    const singleWeek = await getConsolidatedGroceryList(mealUserId, week1, 1, supabase);
    const twoWeeks = await getConsolidatedGroceryList(mealUserId, week1, 3, supabase); // spans week1, week2, week3
    const singleWeekTotalQty = singleWeek.items.reduce((sum, i) => sum + i.quantity, 0);
    const twoWeeksTotalQty = twoWeeks.items.reduce((sum, i) => sum + i.quantity, 0);
    assert(twoWeeksTotalQty > singleWeekTotalQty, `consolidated total (${twoWeeksTotalQty}) exceeds a single week's total (${singleWeekTotalQty}) -- real merging, not just echoing one week`);
    assert(twoWeeks.weeksIncluded.includes(week1) && twoWeeks.weeksIncluded.includes(week2), "both populated weeks are included");
    assert(twoWeeks.weeksMissingPlan.includes(week3), `the untouched week (${week3}) is reported in weeksMissingPlan`);
    console.log(`PASS -- consolidated total (${twoWeeksTotalQty}) > single-week total (${singleWeekTotalQty}); weeksMissingPlan correctly flags ${week3}`);

    // ================= Workout: program-based session assignment (scenario 6) =================
    console.log("\n=== Workout day-assignment (program-based) ===");
    const legacyUserId = await createFixtureUser("weekly-custom-workout-program@areta.local");
    fixtureIds.push(legacyUserId);
    await seedLegacyArchetypeOnboarding(legacyUserId);

    const workoutWeek1 = futureWeekStart(3);
    const bootstrapResult = await generateAndSaveWorkoutPlan(legacyUserId, { weekStart: workoutWeek1 }, supabase);
    assert(bootstrapResult.ok, `legacy-archetype workout plan generated (${!bootstrapResult.ok ? bootstrapResult.error : ""})`);

    const { data: legacyPlanRow } = await supabase.from("workout_plans").select("id, program_phase_id").eq("user_id", legacyUserId).eq("week_start", workoutWeek1).single();
    assert(legacyPlanRow?.program_phase_id, "fixture resolved a real training_programs phase (program_phase_id set)");

    const { data: sessionRows } = await supabase.from("program_sessions").select("id").eq("phase_id", legacyPlanRow!.program_phase_id!).order("session_index").limit(1);
    assert(sessionRows && sessionRows.length > 0, "phase has at least one authored session");
    const sessionId = sessionRows![0].id;

    const { data: sessionExercises } = await supabase.from("program_session_exercises").select("exercise_id").eq("session_id", sessionId).is("primary_exercise_id", null);
    assert(sessionExercises && sessionExercises.length > 0, "session has default exercises");

    const targetDay = 6; // Saturday -- unlikely to already hold this exact session from bootstrap's even spread
    const assignSession = await assignWorkoutPlanSessionDays(legacyUserId, workoutWeek1, sessionId, [targetDay], supabase);
    assert(assignSession.ok, `assignWorkoutPlanSessionDays ok (${!assignSession.ok ? assignSession.error : ""})`);

    const { data: dayItems } = await supabase.from("workout_plan_items").select("exercise_id").eq("workout_plan_id", legacyPlanRow!.id).eq("day_of_week", targetDay);
    const dayExerciseIds = new Set((dayItems ?? []).map((i) => i.exercise_id));
    const sessionExerciseIds = new Set((sessionExercises ?? []).map((i) => i.exercise_id));
    assert(dayExerciseIds.size === sessionExerciseIds.size && [...dayExerciseIds].every((id) => sessionExerciseIds.has(id)), "assigned day's items exactly match the session's exercises");

    const { data: exerciseHistory } = await supabase.from("exercise_pick_history").select("session_id").eq("user_id", legacyUserId).eq("week_start", workoutWeek1).eq("day_of_week", targetDay);
    assert(exerciseHistory && exerciseHistory.length === sessionExerciseIds.size && exerciseHistory.every((h) => h.session_id === sessionId), "exercise_pick_history logged one row per exercise, with session_id set");
    console.log(`PASS -- session assigned to Saturday, ${sessionExerciseIds.size} exercise_pick_history rows logged`);

    // ================= Workout: legacy/goal-first exercise assignment (scenario 7) =================
    console.log("\n=== Workout day-assignment (goal-first, no session concept) ===");
    // Reuses mealUserId's goal-first onboarding -- generateAndSaveWorkoutPlan
    // routes it through generateAndSaveGoalFirstPlan (program_phase_id null),
    // exactly the fork assignWorkoutPlanExerciseDays targets.
    await seedApprovedSessionsPerWeek(mealUserId);
    const workoutWeek2 = futureWeekStart(4);
    const goalFirstBootstrap = await generateAndSaveWorkoutPlan(mealUserId, { weekStart: workoutWeek2 }, supabase);
    assert(goalFirstBootstrap.ok, `goal-first workout plan generated (${!goalFirstBootstrap.ok ? goalFirstBootstrap.error : ""})`);
    const { data: goalFirstPlanRow } = await supabase.from("workout_plans").select("id, program_phase_id").eq("user_id", mealUserId).eq("week_start", workoutWeek2).single();
    assert(goalFirstPlanRow?.program_phase_id === null, "goal-first plan has no program_phase_id, confirming the legacy/exercise-level fork applies");

    const { data: preExistingDayItems } = await supabase.from("workout_plan_items").select("id").eq("workout_plan_id", goalFirstPlanRow!.id).eq("day_of_week", 2);
    const { data: anyExercise } = await supabase.from("exercises").select("id, name").limit(1).single();
    assert(anyExercise, "exercise library has at least one exercise");

    const assignExercise1 = await assignWorkoutPlanExerciseDays(
      mealUserId,
      workoutWeek2,
      { exerciseId: anyExercise.id, sets: 3, reps: 10, durationMinutes: null },
      [2],
      supabase
    );
    assert(assignExercise1.ok, `first assignWorkoutPlanExerciseDays ok (${!assignExercise1.ok ? assignExercise1.error : ""})`);

    const { data: dayAfterFirst } = await supabase.from("workout_plan_items").select("id, exercise_id, substituted").eq("workout_plan_id", goalFirstPlanRow!.id).eq("day_of_week", 2);
    assert(
      (preExistingDayItems?.length ?? 0) === 0 || !(dayAfterFirst ?? []).some((i) => preExistingDayItems!.some((p) => p.id === i.id)),
      "the day's pre-existing algorithm items were replaced (first touch), not left alongside the new pick"
    );
    assert((dayAfterFirst ?? []).some((i) => i.exercise_id === anyExercise.id && i.substituted), "the assigned exercise is present and marked substituted");
    const countAfterFirst = dayAfterFirst?.length ?? 0;

    const { data: anotherExercise } = await supabase.from("exercises").select("id").neq("id", anyExercise.id).limit(1).single();
    assert(anotherExercise, "exercise library has a second distinct exercise");
    const assignExercise2 = await assignWorkoutPlanExerciseDays(
      mealUserId,
      workoutWeek2,
      { exerciseId: anotherExercise.id, sets: 4, reps: 8, durationMinutes: null },
      [2],
      supabase
    );
    assert(assignExercise2.ok, `second assignWorkoutPlanExerciseDays (same day) ok (${!assignExercise2.ok ? assignExercise2.error : ""})`);

    const { data: dayAfterSecond } = await supabase.from("workout_plan_items").select("exercise_id").eq("workout_plan_id", goalFirstPlanRow!.id).eq("day_of_week", 2);
    assert((dayAfterSecond?.length ?? 0) === countAfterFirst + 1, `second pick appended alongside the first (expected ${countAfterFirst + 1} items, got ${dayAfterSecond?.length})`);
    const idsAfterSecond = new Set((dayAfterSecond ?? []).map((i) => i.exercise_id));
    assert(idsAfterSecond.has(anyExercise.id) && idsAfterSecond.has(anotherExercise.id), "both picks are present -- second call appended, did not replace the first");
    console.log(`PASS -- first pick replaced the day's algorithm items (${countAfterFirst} item(s)); second pick to the same day appended instead of re-wiping`);

    console.log("\nAll scenarios passed.");
  } finally {
    for (const id of fixtureIds) await supabase.auth.admin.deleteUser(id);
    console.log(`\nCleaned up ${fixtureIds.length} fixture user(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
