/**
 * End-to-end verification harness for the goal-first recommendation
 * engine (domains/recommendation/*). Creates throwaway fixture users
 * via the admin API (same pattern as scripts/seed.ts), seeds their
 * goal-first onboarding answers + an approved sessions_per_week
 * parameter, runs the REAL generateAndSaveWorkoutPlan end to end
 * (template selection -> slot fill -> prescription -> persistence,
 * including provenance + alternates), asserts on the persisted rows,
 * and deletes the fixtures afterwards.
 *
 * Also regression-checks the legacy archetype path still routes through
 * the old program pipeline untouched.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-goalfirst-engine.ts
 * (the scripts tsconfig aliases `server-only` to its empty.js — the
 * same substitution vitest.config.ts already documents — so importing
 * the real domain services works outside Next's bundler.)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";

const supabase = createScriptAdminClient();

/** Imported dynamically inside main() — the domain-service import chain
 * eagerly parses public env vars at module load (platform/env.ts), so
 * it must not be hoisted above loadEnv(). */
type WorkoutPlanService = typeof import("@/domains/workoutplan/service");

type Scenario = {
  label: string;
  email: string;
  exercise: Record<string, unknown>;
  sessionsPerWeek: number;
  expect: (ctx: { planRow: PlanRow; items: ItemRow[]; warnings: string[]; exerciseNames: Map<string, { name: string; patterns: string[] }> }) => void;
};

type PlanRow = {
  id: string;
  template_id: string | null;
  template_phase_id: string | null;
  program_id: string | null;
  phase_week_number: number | null;
  phase_focus: string | null;
  status: string;
};
type ItemRow = {
  id: string;
  day_of_week: number;
  exercise_id: string;
  sets: number | null;
  duration_minutes: number | null;
  template_slot_id: string | null;
  provenance: unknown;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const SCENARIOS: Scenario[] = [
  {
    label: "build_muscle / intermediate / full_gym / 45",
    email: "engine-test-hypertrophy@areta.local",
    sessionsPerWeek: 4,
    exercise: {
      primaryGoal: "build_muscle",
      recentExperience: "consistent",
      daysPerWeek: "4",
      sessionDurationBand: "45",
      trainingLocation: "full_gym",
      equipmentAccess: ["Full gym access", "Barbell", "Dumbbells", "Pull-up bar"],
      injuryStatus: "no",
    },
    expect: ({ planRow, items }) => {
      assert(planRow.template_id, "plan tagged with a template_id");
      assert(planRow.program_id === null, "legacy program_id stays null");
      assert(planRow.phase_week_number === 1, "starts at phase week 1");
      const trainingDays = new Set(items.map((i) => i.day_of_week));
      assert(trainingDays.size === 4, `4 training days (got ${trainingDays.size})`);
      assert(items.every((i) => i.template_slot_id), "every item links its template slot");
      assert(items.every((i) => i.provenance && (i.provenance as { claimIds: string[] }).claimIds.length > 0), "every item carries claim provenance");
      const resistanceItems = items.filter((i) => i.sets !== null);
      assert(resistanceItems.length > 0, "has resistance items with sets");
    },
  },
  {
    label: "improve_endurance / beginner / outdoors / 30",
    email: "engine-test-endurance@areta.local",
    sessionsPerWeek: 3,
    exercise: {
      primaryGoal: "improve_endurance",
      recentExperience: "new_or_returning",
      daysPerWeek: "3",
      sessionDurationBand: "30",
      trainingLocation: "outdoors",
      equipmentAccess: ["Bodyweight only"],
      preferredActivities: ["running"],
      injuryStatus: "no",
    },
    expect: ({ planRow, items, exerciseNames }) => {
      assert(planRow.template_id, "plan tagged with a template_id");
      const aerobicItems = items.filter((i) => i.duration_minutes !== null);
      assert(aerobicItems.length >= 3, `mostly aerobic sessions (got ${aerobicItems.length})`);
      for (const item of aerobicItems) {
        const patterns = exerciseNames.get(item.exercise_id)?.patterns ?? [];
        assert(patterns.some((p) => ["run", "bike", "swim", "row"].includes(p)), "aerobic slots filled from the aerobic group");
      }
    },
  },
  {
    label: "lose_fat / intermediate / home_no_equipment / 30 + lower_back limitation",
    email: "engine-test-limitation@areta.local",
    sessionsPerWeek: 3,
    exercise: {
      primaryGoal: "lose_fat",
      recentExperience: "consistent",
      daysPerWeek: "3",
      sessionDurationBand: "30",
      trainingLocation: "home_no_equipment",
      equipmentAccess: ["Bodyweight only"],
      injuryStatus: "yes",
      limitationTags: ["lower_back"],
    },
    expect: ({ items, exerciseNames }) => {
      for (const item of items) {
        const info = exerciseNames.get(item.exercise_id);
        assert(info, `exercise ${item.exercise_id} in library`);
        assert(!info!.patterns.includes("olympic_lift"), `no olympic lifts for lower_back (${info!.name})`);
      }
      // Exercises TAGGED lower_back (deadlift, good morning, back squat,
      // russian twist, ab wheel...) must be absent entirely.
      const taggedNames = ["Barbell deadlift", "Good morning", "Barbell back squat", "Russian twist", "Ab wheel rollout"];
      for (const item of items) {
        assert(!taggedNames.includes(exerciseNames.get(item.exercise_id)!.name), `lower_back-tagged exercise excluded (${exerciseNames.get(item.exercise_id)!.name})`);
      }
    },
  },
];

const LEGACY_SCENARIO = {
  label: "LEGACY REGRESSION: archetype-shape user still uses the program pipeline",
  email: "engine-test-legacy@areta.local",
  sessionsPerWeek: 3,
  exercise: {
    archetype: "general_fitness",
    experienceLevel: "intermediate",
    daysPerWeekAvailable: 3,
    equipmentAccess: ["Full gym access"],
  },
};

async function createFixtureUser(email: string, exercise: Record<string, unknown>, sessionsPerWeek: number): Promise<string> {
  // Clean any leftover fixture from a previous run.
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const leftover = userList?.users.find((u) => u.email === email);
  if (leftover) await supabase.auth.admin.deleteUser(leftover.id);

  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser(${email}): ${error?.message}`);
  const userId = data.user.id;

  const { error: onboardingError } = await supabase.from("onboarding_responses").upsert({
    user_id: userId,
    exercise: exercise as never,
    completed_steps: ["identity", "goals", "exercise"],
  });
  if (onboardingError) throw new Error(`onboarding_responses: ${onboardingError.message}`);

  const { error: paramError } = await supabase.from("generated_parameters").insert({
    user_id: userId,
    domain: "exercise",
    name: "sessions_per_week",
    value: sessionsPerWeek,
    unit: "sessions/week",
    source: "rule",
    rationale: "engine verification fixture",
    confidence: 0.8,
    approved: true,
  });
  if (paramError) throw new Error(`generated_parameters: ${paramError.message}`);

  return userId;
}

async function main() {
  const { generateAndSaveWorkoutPlan }: WorkoutPlanService = await import("@/domains/workoutplan/service");
  const { data: exerciseRows } = await supabase.from("exercises").select("id, name, movement_patterns").eq("status", "active");
  const exerciseNames = new Map((exerciseRows ?? []).map((e) => [e.id, { name: e.name, patterns: e.movement_patterns }]));

  const fixtureIds: string[] = [];
  let failures = 0;

  try {
    for (const scenario of SCENARIOS) {
      console.log(`\n=== ${scenario.label} ===`);
      const userId = await createFixtureUser(scenario.email, scenario.exercise, scenario.sessionsPerWeek);
      fixtureIds.push(userId);

      const result = await generateAndSaveWorkoutPlan(userId, undefined, supabase);
      if (!result.ok) throw new Error(`generation failed: ${result.error}`);
      console.log(`warnings: ${result.data.warnings.length ? result.data.warnings.join(" | ") : "(none)"}`);

      const { data: planRow } = await supabase
        .from("workout_plans")
        .select("id, template_id, template_phase_id, program_id, phase_week_number, phase_focus, status")
        .eq("user_id", userId)
        .single();
      const { data: items } = await supabase
        .from("workout_plan_items")
        .select("id, day_of_week, exercise_id, sets, duration_minutes, template_slot_id, provenance")
        .eq("workout_plan_id", planRow!.id)
        .order("day_of_week")
        .order("session_order");
      const { data: alternates } = await supabase
        .from("workout_plan_item_alternatives")
        .select("id, workout_plan_item_id, rank")
        .in("workout_plan_item_id", (items ?? []).map((i) => i.id));

      console.log(`plan: template=${planRow!.template_id?.slice(0, 8)} phase_week=${planRow!.phase_week_number} focus="${planRow!.phase_focus}"`);
      console.log(`items: ${items!.length} across days [${[...new Set(items!.map((i) => i.day_of_week))].join(",")}]; alternates: ${alternates!.length}`);
      for (const item of items!.slice(0, 6)) {
        const info = exerciseNames.get(item.exercise_id)!;
        console.log(`  day ${item.day_of_week}: ${info.name} — sets=${item.sets ?? "-"} dur=${item.duration_minutes ?? "-"}min`);
      }

      try {
        scenario.expect({ planRow: planRow as PlanRow, items: (items ?? []) as ItemRow[], warnings: result.data.warnings, exerciseNames });
        assert((alternates ?? []).length > 0, "alternates persisted");
        console.log("PASS");
      } catch (e) {
        failures++;
        console.error(`FAIL: ${(e as Error).message}`);
      }
    }

    // Legacy regression
    console.log(`\n=== ${LEGACY_SCENARIO.label} ===`);
    const legacyId = await createFixtureUser(LEGACY_SCENARIO.email, LEGACY_SCENARIO.exercise, LEGACY_SCENARIO.sessionsPerWeek);
    fixtureIds.push(legacyId);
    const legacyResult = await generateAndSaveWorkoutPlan(legacyId, undefined, supabase);
    if (!legacyResult.ok) throw new Error(`legacy generation failed: ${legacyResult.error}`);
    const { data: legacyPlan } = await supabase
      .from("workout_plans")
      .select("template_id, program_id")
      .eq("user_id", legacyId)
      .single();
    try {
      assert(legacyPlan!.template_id === null, "legacy plan has no template_id");
      // program_id may be null (thin-archetype library fallback) but the
      // path must NOT have gone through the template engine.
      console.log(`legacy plan: program=${legacyPlan!.program_id ? legacyPlan!.program_id.slice(0, 8) : "(library fallback)"} template=${legacyPlan!.template_id}`);
      console.log("PASS");
    } catch (e) {
      failures++;
      console.error(`FAIL: ${(e as Error).message}`);
    }
  } finally {
    for (const id of fixtureIds) {
      await supabase.auth.admin.deleteUser(id);
    }
    console.log(`\nCleaned up ${fixtureIds.length} fixture users.`);
  }

  if (failures > 0) {
    console.error(`\n${failures} scenario(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll scenarios passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
