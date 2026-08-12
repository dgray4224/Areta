/**
 * Idempotent demo/QA seed: creates (or reuses) a self-service demo account
 * and fills every user-data domain the mobile app reads with realistic,
 * schema-valid mock data spanning a rolling 60-day trailing window plus
 * ~4 weeks forward, so every screen has something to render for design/UX
 * review -- no blank spots.
 *
 * Deliberately hand-authors plan data (real exercise_id/recipe_id rows
 * pulled from the shared reference tables, sensible sets/reps/servings)
 * rather than driving the real recommendation/goal-first engines --
 * those live in "use server" files (domains/mealplan/service.ts,
 * domains/workoutplan/service.ts, etc.) that transitively import
 * platform/supabase/server.ts, which imports the "server-only" package
 * and throws unconditionally outside Next's bundler (same constraint
 * scripts/dev-generate-founder-plan.ts's own doc comment describes).
 * Good enough fidelity for a UI review account, and doesn't need to track
 * whichever plan-generation pipeline happens to be "current". Reuses real
 * shared logic where it's safe to import directly: transformOnboarding +
 * writeOnboardingOutput (identical to scripts/seed.ts's pattern),
 * logScheduleEvent, and recomputeActivityDailySummaryForDay (identical to
 * scripts/backfill-activity-daily-summaries.ts's pattern) -- none of those
 * import "server-only".
 *
 * One known gap by design: workout_plans.program_id/program_phase_id are
 * linked to a real training_programs/training_program_phases pair purely
 * so GET /api/plan/program (the mobile Plan tab's "Program" sub-tab) has
 * something to resolve -- see that route's own doc comment on the three
 * parallel systems it branches on. The exercises actually listed in
 * workout_plan_items are still hand-picked, not materialized from that
 * program's real sessions, so don't expect the two to match exercise-for-
 * exercise the way a real generated plan would.
 *
 * Refuses to run unless ALLOW_SEED=true, same guard as scripts/seed.ts.
 * Safe to re-run any time: wipes and regenerates this one account's rows
 * (scoped by demo user id only, every table filtered on user_id) with
 * dates computed from `now`, so the account never goes stale.
 *
 * Invoke: ALLOW_SEED=true pnpm run seed:demo
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { SupabaseClient } from "@supabase/supabase-js";
import { createScriptAdminClient } from "./lib/admin-client";
import { transformOnboarding } from "@/domains/onboarding/transform";
import { writeOnboardingOutput } from "@/domains/onboarding/write-output";
import type { OnboardingResponses, OnboardingStepKey } from "@/domains/onboarding/types";
import { identitySchema, type IdentityInput, workScheduleSchema, type WorkScheduleInput } from "@/domains/identity/schema";
import type { Goal } from "@/domains/goals/schema";
import { nutritionSchema, type NutritionInput } from "@/domains/nutrition/schema";
import { exerciseSchema, type ExerciseInput } from "@/domains/exercise/schema";
import { learningSchema, type LearningInput } from "@/domains/learning/schema";
import { coachingSchema, type CoachingInput } from "@/domains/coaching/schema";
import { getWeekDates, addDays as addDateStr } from "@/platform/ui/week-dates";
import { logScheduleEvent } from "@/platform/scheduling/log-schedule-event";
import { recomputeActivityDailySummaryForDay } from "@/domains/activity-summary/service";
import type { Database } from "@/platform/db/types";

type AdminClient = SupabaseClient<Database>;

const DEMO_EMAIL = "demo+fulldata@areta.local";
const DEMO_PASSWORD = "areta-demo-seed-only-not-for-real-use";

const HISTORY_DAYS = 60; // trailing window -- matches streaks.ts's own 60-day WINDOW_DAYS
const FORWARD_WEEKS = 4; // matches SELF_SERVICE_WEEKS_AHEAD, so Plan's month view has coverage
const WORKOUT_DAYS = [1, 2, 3, 5, 6]; // Mon/Tue/Wed/Fri/Sat; Sun(0)/Thu(4) rest -- 5 sessions/week
const CARDIO_PATTERNS = new Set(["aerobic", "anaerobic / speed", "full body / conditioning"]);

// ---------------------------------------------------------------------------
// Small date helpers. UTC-based throughout, same convention platform/ui/
// week-dates.ts uses -- fine for a seed script (not a per-user-timezone-
// correct write path).
// ---------------------------------------------------------------------------
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  return addDateStr(todayIso(), -n);
}
function daysAhead(n: number): string {
  return addDateStr(todayIso(), n);
}
function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}
/** Midday UTC on `dateStr` -- comfortably inside that same local calendar
 * day for any continental US timezone, so health_metrics rows land in the
 * right day-bucket without this script resolving the demo profile's actual
 * IANA timezone itself (domains/activity-summary/timezone.ts's job, not
 * this one-off seed's). */
function middayUtc(dateStr: string): string {
  return `${dateStr}T16:00:00.000Z`;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 1): number {
  const v = Math.random() * (max - min) + min;
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function chance(p: number): boolean {
  return Math.random() < p;
}

// ---------------------------------------------------------------------------
// Demo persona -- generic self-service user, no injury/clinical framing
// (recovery step intentionally skipped), general-fitness + fat-loss goal.
// ---------------------------------------------------------------------------
const demoIdentity: IdentityInput = identitySchema.parse({
  fullName: "Alex Demo",
  timeZone: "America/New_York",
  units: "imperial",
  wakeTime: "06:30",
  bedTime: "22:30",
  weeklyReviewDay: 0,
  groceryDay: 6,
  mealPrepDay: 0,
} satisfies IdentityInput);

const demoWorkSchedule: WorkScheduleInput = workScheduleSchema.parse({
  workStatus: "Full-time, hybrid",
  workHoursNote: "Mostly 9-5 with some evening flexibility",
  schoolCommitments: "",
  learningTimeMinutesPerWeek: 240,
} satisfies WorkScheduleInput);

const START_WEIGHT = 198;
const TARGET_WEIGHT = 180;

const demoGoals: Goal[] = [
  {
    domainKey: "nutrition",
    outcome: `Reach ${TARGET_WEIGHT} pounds at a sustainable pace`,
    why: "Feel lighter and more energetic day to day",
    targetDate: daysAhead(150),
    startingState: `Currently around ${START_WEIGHT} pounds`,
    constraints: "Busy weekday schedule, cook at home most nights",
    successCriteria: `Seven-day average at or under ${TARGET_WEIGHT} lbs`,
    priority: 1,
    confidence: 4,
    knownObstacles: "Travel for work a few times a quarter",
    targetMetricType: "weight_lb",
    targetValue: TARGET_WEIGHT,
    targetDirection: "decrease",
  },
  {
    domainKey: "exercise",
    outcome: "Build a consistent 5-day training routine and get noticeably stronger",
    why: "Long-term health and confidence",
    targetDate: daysAhead(120),
    startingState: "Training inconsistently, 2-3x/week",
    constraints: "Full gym access on weekdays only",
    successCriteria: "5 sessions/week for 8 straight weeks, key lifts up 15%",
    priority: 2,
    confidence: 4,
    knownObstacles: "Motivation dips mid-week",
  },
  {
    domainKey: "learning",
    outcome: "Ship a personal coding project end to end",
    why: "Keep skills sharp and build a portfolio piece",
    targetDate: daysAhead(180),
    startingState: "Have the idea, haven't started building",
    constraints: "Evenings and weekends only",
    successCriteria: "Deployed, working product with at least one real user",
    priority: 3,
    confidence: 3,
    knownObstacles: "Limited free time",
    targetMetricType: "learning_minutes_weekly",
    targetValue: 240,
    targetDirection: "increase",
  },
];

const demoNutrition: NutritionInput = nutritionSchema.parse({
  height: 70,
  currentWeight: START_WEIGHT,
  targetWeight: TARGET_WEIGHT,
  age: 32,
  sex: "male",
  activityLevel: "moderate",
  allergies: [],
  dislikedFoods: [],
  mealsPerDay: 3,
  trackingPreference: "simple",
  proteinTargetGrams: 160,
} satisfies NutritionInput);

const demoExercise: ExerciseInput = exerciseSchema.parse({
  primaryGoal: "improve_general_fitness",
  recentExperience: "consistent",
  daysPerWeek: "5_plus",
  sessionDurationBand: "45",
  trainingLocation: "full_gym",
  equipmentAccess: ["Barbell", "Dumbbells", "Kettlebells", "Pull-up bar", "Cardio machine", "Full gym access"],
  preferredActivities: ["strength_training", "interval_training"],
  dislikedActivities: [],
  injuryStatus: "no",
} satisfies ExerciseInput);

const demoLearning: LearningInput = learningSchema.parse({
  careerDirection: ["Software / AI engineering"],
  currentSkills: ["Software development"],
  desiredSkills: ["AI engineering", "product building"],
  preferredFormat: "project",
  weeklyAvailableHours: 5,
  formalCoursePlans: "",
} satisfies LearningInput);

const demoCoaching: CoachingInput = coachingSchema.parse({
  tone: "direct",
  planningStyle: "flexible",
  reminderPreference: "minimal",
  explanationDepth: "detailed",
  rescheduleMissedTasks: true,
  neverRecommend: [],
} satisfies CoachingInput);

const CALORIE_TARGET = 2100;
const PROTEIN_TARGET = 160;

// ---------------------------------------------------------------------------
// User creation + idempotent wipe
// ---------------------------------------------------------------------------
async function getOrCreateDemoUser(supabase: AdminClient): Promise<string> {
  const { data: existingUsers, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const existing = existingUsers.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    console.log(`Reusing existing demo user: ${DEMO_EMAIL}`);
    return existing.id;
  }
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (createError || !data.user) throw createError ?? new Error("Failed to create demo user");
  console.log(`Created demo user: ${DEMO_EMAIL}`);
  return data.user.id;
}

/** Every table this script writes to, filtered by user_id. Cascade
 * (on delete cascade) already clears most child rows when their parent is
 * deleted (workout_plan_items/meal_plan_items/grocery_items/prep_steps/
 * action_events), but deleting every table explicitly is simpler to audit
 * and harmless -- a delete matching zero rows is a no-op. profiles/
 * auth.users are intentionally not deleted; writeOnboardingOutput below
 * updates the profile row in place. */
async function wipeExistingData(supabase: AdminClient, userId: string): Promise<void> {
  const tables: (keyof Database["public"]["Tables"])[] = [
    "grocery_items",
    "prep_steps",
    "workout_plan_items",
    "meal_plan_items",
    "action_events",
    "grocery_lists",
    "prep_plans",
    "workout_plans",
    "meal_plans",
    "daily_actions",
    "schedule_events",
    "custom_timeline_events",
    "exercise_logs",
    "nutrition_logs",
    "health_metrics",
    "activity_daily_summaries",
    "recovery_logs",
    "study_sessions",
    "weekly_outcomes",
    "weekly_reviews",
    "recommendations",
    "goals",
    "phases",
    "domains",
    "onboarding_responses",
    "personalization_profiles",
    "daily_checkin_fields",
    "generated_parameters",
  ];
  for (const table of tables) {
    // Cast to a loosely-typed client here: supabase-js can't resolve a
    // polymorphic .delete().eq() across a union of table names (each has a
    // structurally different Row/filter type), which is exactly what this
    // dynamic wipe-every-table loop needs to do.
    const { error } = await (supabase as SupabaseClient).from(table).delete().eq("user_id", userId);
    if (error) console.warn(`  wipe ${table}: ${error.message}`);
  }
  console.log("Wiped existing demo data.");
}

// ---------------------------------------------------------------------------
// Identity / goals / onboarding -- reuses the exact real domain functions
// scripts/seed.ts uses, so domains/goals/phases/weekly_outcomes(initial)/
// personalization_profiles/daily_checkin_fields all come out of the same
// code path a real onboarding completion would produce.
// ---------------------------------------------------------------------------
async function seedIdentityGoalsOnboarding(
  supabase: AdminClient,
  userId: string
): Promise<{ goalIdByOutcome: Map<string, string>; domainIdByKey: Map<string, string> }> {
  const completedSteps: OnboardingStepKey[] = ["identity", "goals", "nutrition", "exercise", "learning"];

  const responses: OnboardingResponses = {
    userId,
    identity: demoIdentity,
    goals: demoGoals,
    nutrition: demoNutrition,
    exercise: demoExercise,
    recovery: null,
    learning: demoLearning,
    completedSteps,
  };

  const { error: onboardingError } = await supabase.from("onboarding_responses").upsert(
    {
      user_id: userId,
      identity: responses.identity,
      goals: responses.goals,
      nutrition: responses.nutrition,
      exercise: responses.exercise,
      recovery: responses.recovery,
      learning: responses.learning,
      completed_steps: responses.completedSteps,
    },
    { onConflict: "user_id" }
  );
  if (onboardingError) throw onboardingError;

  const output = transformOnboarding(responses);
  const result = await writeOnboardingOutput(supabase, userId, responses, output);
  if (!result.ok) throw new Error(result.error);

  const { error: workScheduleError } = await supabase
    .from("profiles")
    .update({
      work_status: demoWorkSchedule.workStatus || null,
      work_hours_note: demoWorkSchedule.workHoursNote || null,
      school_commitments: demoWorkSchedule.schoolCommitments || null,
      learning_time_minutes_per_week: demoWorkSchedule.learningTimeMinutesPerWeek ?? null,
    })
    .eq("id", userId);
  if (workScheduleError) throw workScheduleError;

  // Same as scripts/seed.ts: overwrite writeOnboardingOutput's heuristic
  // initial personalization_profiles row with the persona's real coaching
  // answers, since OnboardingResponses has no coaching field of its own.
  const { error: coachingError } = await supabase.from("personalization_profiles").upsert(
    {
      user_id: userId,
      tone: demoCoaching.tone,
      planning_style: demoCoaching.planningStyle,
      reminder_preference: demoCoaching.reminderPreference,
      explanation_depth: demoCoaching.explanationDepth,
      reschedule_missed_tasks: demoCoaching.rescheduleMissedTasks,
      never_recommend: demoCoaching.neverRecommend,
    },
    { onConflict: "user_id" }
  );
  if (coachingError) throw coachingError;

  const [{ data: goalRows, error: goalsError }, { data: domainRows, error: domainsError }] = await Promise.all([
    supabase.from("goals").select("id, outcome").eq("user_id", userId),
    supabase.from("domains").select("id, key").eq("user_id", userId),
  ]);
  if (goalsError) throw goalsError;
  if (domainsError) throw domainsError;

  const goalIdByOutcome = new Map((goalRows ?? []).map((g) => [g.outcome, g.id]));
  const domainIdByKey = new Map((domainRows ?? []).map((d) => [d.key, d.id]));
  console.log(`Seeded identity, ${demoGoals.length} goals, ${domainRows?.length ?? 0} domains, phases, personalization.`);
  return { goalIdByOutcome, domainIdByKey };
}

// ---------------------------------------------------------------------------
// Reference data loaders
// ---------------------------------------------------------------------------
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];

async function loadExercises(supabase: AdminClient): Promise<ExerciseRow[]> {
  const { data, error } = await supabase.from("exercises").select("*").contains("archetype_tags", ["general_fitness"]);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No exercises found tagged general_fitness -- is the exercise library seeded?");
  return data;
}

async function loadRecipes(supabase: AdminClient): Promise<Record<"breakfast" | "lunch" | "dinner" | "snack", RecipeRow[]>> {
  const { data, error } = await supabase.from("recipes").select("*");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No recipes found -- is the recipe library seeded?");
  return {
    breakfast: data.filter((r) => r.meal_type === "breakfast"),
    lunch: data.filter((r) => r.meal_type === "lunch"),
    dinner: data.filter((r) => r.meal_type === "dinner"),
    snack: data.filter((r) => r.meal_type === "snack"),
  };
}

async function loadFirstGeneralFitnessProgramPhase(
  supabase: AdminClient
): Promise<{ programId: string; phaseId: string } | null> {
  const { data: program } = await supabase
    .from("training_programs")
    .select("id")
    .eq("archetype", "general_fitness")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!program) return null;
  const { data: phase } = await supabase
    .from("training_program_phases")
    .select("id")
    .eq("program_id", program.id)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!phase) return null;
  return { programId: program.id, phaseId: phase.id };
}

// ---------------------------------------------------------------------------
// Workout + meal plans, current week + FORWARD_WEEKS ahead
// ---------------------------------------------------------------------------
type WorkoutPlanRow = Database["public"]["Tables"]["workout_plans"]["Row"];
type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];

async function seedWorkoutPlans(
  supabase: AdminClient,
  userId: string,
  weekStarts: string[],
  exercises: ExerciseRow[]
): Promise<Map<string, WorkoutPlanRow>> {
  const programPhase = await loadFirstGeneralFitnessProgramPhase(supabase);
  const plansByWeek = new Map<string, WorkoutPlanRow>();

  for (let weekIndex = 0; weekIndex < weekStarts.length; weekIndex++) {
    const weekStart = weekStarts[weekIndex];
    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .insert({
        user_id: userId,
        week_start: weekStart,
        status: "active",
        sessions_per_week: WORKOUT_DAYS.length,
        phase_focus: "General strength & conditioning",
        program_id: programPhase?.programId ?? null,
        program_phase_id: programPhase?.phaseId ?? null,
        phase_week_number: programPhase ? weekIndex + 1 : null,
      })
      .select("*")
      .single();
    if (planError || !plan) throw planError ?? new Error("Failed to insert workout plan");
    plansByWeek.set(weekStart, plan);

    const items = WORKOUT_DAYS.map((day, dayIndex) => {
      // Rotate the pool by week+day so consecutive weeks don't look identical.
      const offset = (weekIndex * WORKOUT_DAYS.length + dayIndex) * 5;
      const dayExercises = Array.from({ length: 5 }, (_, i) => exercises[(offset + i) % exercises.length]);
      return dayExercises.map((ex, order) => {
        const isCardio = CARDIO_PATTERNS.has(ex.movement_pattern);
        return {
          workout_plan_id: plan.id,
          user_id: userId,
          day_of_week: day,
          session_order: order,
          exercise_id: ex.id,
          sets: isCardio ? null : 3,
          reps: isCardio ? null : randInt(8, 12),
          duration_minutes: isCardio ? randInt(20, 30) : null,
        };
      });
    }).flat();

    const { error: itemsError } = await supabase.from("workout_plan_items").insert(items);
    if (itemsError) throw itemsError;
  }

  console.log(`Seeded ${weekStarts.length} weeks of active workout plans (${WORKOUT_DAYS.length} sessions/week).`);
  return plansByWeek;
}

async function seedMealPlans(
  supabase: AdminClient,
  userId: string,
  weekStarts: string[],
  recipes: Record<"breakfast" | "lunch" | "dinner" | "snack", RecipeRow[]>
): Promise<Map<string, MealPlanRow>> {
  const plansByWeek = new Map<string, MealPlanRow>();

  for (let weekIndex = 0; weekIndex < weekStarts.length; weekIndex++) {
    const weekStart = weekStarts[weekIndex];
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        user_id: userId,
        week_start: weekStart,
        status: "active",
        calorie_target: CALORIE_TARGET,
        protein_target: PROTEIN_TARGET,
      })
      .select("*")
      .single();
    if (planError || !plan) throw planError ?? new Error("Failed to insert meal plan");
    plansByWeek.set(weekStart, plan);

    const items: Database["public"]["Tables"]["meal_plan_items"]["Insert"][] = [];
    for (let day = 0; day < 7; day++) {
      const offset = weekIndex * 7 + day;
      items.push({
        meal_plan_id: plan.id,
        user_id: userId,
        day_of_week: day,
        meal_type: "breakfast",
        recipe_id: recipes.breakfast[offset % recipes.breakfast.length].id,
        servings: 1,
      });
      items.push({
        meal_plan_id: plan.id,
        user_id: userId,
        day_of_week: day,
        meal_type: "lunch",
        recipe_id: recipes.lunch[offset % recipes.lunch.length].id,
        servings: 1,
      });
      items.push({
        meal_plan_id: plan.id,
        user_id: userId,
        day_of_week: day,
        meal_type: "dinner",
        recipe_id: recipes.dinner[offset % recipes.dinner.length].id,
        servings: 1,
      });
      if (day % 2 === 0) {
        items.push({
          meal_plan_id: plan.id,
          user_id: userId,
          day_of_week: day,
          meal_type: "snack",
          recipe_id: recipes.snack[offset % recipes.snack.length].id,
          servings: 1,
        });
      }
    }
    const { error: itemsError } = await supabase.from("meal_plan_items").insert(items);
    if (itemsError) throw itemsError;
  }

  console.log(`Seeded ${weekStarts.length} weeks of active meal plans.`);
  return plansByWeek;
}

/** Grocery list + prep plan for the current week only -- aggregates real
 * ingredient quantities off that week's meal_plan_items' recipes, so the
 * Plan tab's Grocery & Prep sub-tab has a genuinely derived list rather
 * than placeholder text. */
async function seedGroceryAndPrep(
  supabase: AdminClient,
  userId: string,
  weekStart: string,
  mealPlan: MealPlanRow,
  recipes: Record<"breakfast" | "lunch" | "dinner" | "snack", RecipeRow[]>
): Promise<void> {
  const { data: items, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select("recipe_id, meal_type, servings")
    .eq("meal_plan_id", mealPlan.id);
  if (itemsError) throw itemsError;

  const allRecipes = [...recipes.breakfast, ...recipes.lunch, ...recipes.dinner, ...recipes.snack];
  const recipeById = new Map(allRecipes.map((r) => [r.id, r]));

  type Ingredient = { name: string; quantity: number; unit: string; section: string };
  const aggregated = new Map<string, Ingredient & { neededFor: Set<string> }>();
  for (const item of items ?? []) {
    const recipe = recipeById.get(item.recipe_id);
    if (!recipe) continue;
    const ingredients = (recipe.ingredients as unknown as Ingredient[]) ?? [];
    for (const ing of ingredients) {
      const key = `${ing.name}__${ing.unit}`;
      const existing = aggregated.get(key);
      const qty = (ing.quantity ?? 0) * (item.servings ?? 1);
      if (existing) {
        existing.quantity += qty;
        existing.neededFor.add(recipe.name);
      } else {
        aggregated.set(key, { ...ing, quantity: qty, neededFor: new Set([recipe.name]) });
      }
    }
  }

  const { data: groceryList, error: listError } = await supabase
    .from("grocery_lists")
    .insert({ user_id: userId, meal_plan_id: mealPlan.id, week_start: weekStart, status: "active" })
    .select("id")
    .single();
  if (listError || !groceryList) throw listError ?? new Error("Failed to insert grocery list");

  const groceryItems = Array.from(aggregated.values()).map((ing) => ({
    grocery_list_id: groceryList.id,
    user_id: userId,
    name: ing.name,
    quantity: Math.round(ing.quantity * 100) / 100,
    unit: ing.unit,
    section: ing.section || "other",
    needed_for: Array.from(ing.neededFor),
    is_checked: false,
  }));
  if (groceryItems.length > 0) {
    const { error } = await supabase.from("grocery_items").insert(groceryItems);
    if (error) throw error;
  }

  const { data: prepPlan, error: prepError } = await supabase
    .from("prep_plans")
    .insert({
      user_id: userId,
      meal_plan_id: mealPlan.id,
      week_start: weekStart,
      estimated_minutes: 90,
      container_count: 8,
      status: "active",
    })
    .select("id")
    .single();
  if (prepError || !prepPlan) throw prepError ?? new Error("Failed to insert prep plan");

  const prepSteps = [
    "Batch-cook proteins for the week (chicken, ground turkey) and portion into containers.",
    "Cook a large batch of rice/quinoa and divide across containers.",
    "Wash and chop produce for quick assembly during the week.",
    "Portion breakfasts into grab-and-go containers.",
    "Label containers by day and refrigerate; freeze anything not needed in the first 3 days.",
  ].map((instruction, i) => ({
    prep_plan_id: prepPlan.id,
    user_id: userId,
    step_number: i + 1,
    instruction,
  }));
  const { error: stepsError } = await supabase.from("prep_steps").insert(prepSteps);
  if (stepsError) throw stepsError;

  console.log(`Seeded grocery list (${groceryItems.length} items) and prep plan for week ${weekStart}.`);
}

/** Marks this week's already-past plan items done (migration
 * 0020_plan_item_completion.sql's completed_at flags) -- without this,
 * meal_plan_items/workout_plan_items.completed_at stay null forever, and
 * the Review tab's Plan Recap sub-tab (lib/review-screens/
 * PlanAdherenceRecap.tsx, mobile repo) reads exactly those flags, so it
 * would show 0% completion despite everything else being fully seeded.
 * Meal completion mirrors what the real "complete" checkbox does
 * (domains/mealplan/service.ts's setMealPlanItemCompleted): write a real
 * nutrition_logs row derived from the recipe and link it via
 * nutrition_log_id, not just flip the flag. Workout completion has no
 * linked log by design (the migration's own comment: HealthKit's synced
 * workout_logs already captures "what actually happened" independently).
 * Today only gets breakfast/lunch completed and no workout, matching the
 * "today is partially logged" realism used elsewhere in this script --
 * dinner and today's workout are left incomplete since they haven't
 * happened yet. */
async function completeCurrentWeekPastItems(
  supabase: AdminClient,
  userId: string,
  currentWeekStart: string,
  mealPlan: MealPlanRow,
  workoutPlan: WorkoutPlanRow,
  recipeById: Map<string, RecipeRow>
): Promise<void> {
  const weekDates = getWeekDates(currentWeekStart);
  const today = todayIso();

  const [{ data: mealItems, error: mealErr }, { data: workoutItems, error: workoutErr }] = await Promise.all([
    supabase.from("meal_plan_items").select("id, day_of_week, meal_type, recipe_id").eq("meal_plan_id", mealPlan.id),
    supabase.from("workout_plan_items").select("id, day_of_week").eq("workout_plan_id", workoutPlan.id),
  ]);
  if (mealErr) throw mealErr;
  if (workoutErr) throw workoutErr;

  let completedMeals = 0;
  for (const item of mealItems ?? []) {
    const date = weekDates[item.day_of_week];
    const isPast = date < today;
    const isTodayEarlyMeal = date === today && (item.meal_type === "breakfast" || item.meal_type === "lunch");
    if (!isPast && !isTodayEarlyMeal) continue;

    const recipe = recipeById.get(item.recipe_id);
    if (!recipe) continue;

    const { data: log, error: logError } = await supabase
      .from("nutrition_logs")
      .insert({
        user_id: userId,
        date,
        meal: item.meal_type,
        food: recipe.name,
        quantity: 1,
        unit: "serving",
        calories: recipe.calories,
        protein: recipe.protein_g,
        carbohydrates: recipe.carbs_g,
        fat: recipe.fat_g,
        fiber: recipe.fiber_g,
      })
      .select("id")
      .single();
    if (logError || !log) throw logError ?? new Error("Failed to insert nutrition log for plan completion");

    const { error: updateError } = await supabase
      .from("meal_plan_items")
      .update({ completed_at: middayUtc(date), nutrition_log_id: log.id })
      .eq("id", item.id);
    if (updateError) throw updateError;
    completedMeals++;
  }

  let completedWorkouts = 0;
  for (const item of workoutItems ?? []) {
    const date = weekDates[item.day_of_week];
    if (date >= today) continue; // today's/future workouts haven't happened yet
    const { error } = await supabase.from("workout_plan_items").update({ completed_at: middayUtc(date) }).eq("id", item.id);
    if (error) throw error;
    completedWorkouts++;
  }

  console.log(`Marked ${completedMeals} meal_plan_items and ${completedWorkouts} workout_plan_items completed for the current week.`);
}

// ---------------------------------------------------------------------------
// schedule_events -- one upsert per planned workout/meal/custom item, via
// the real logScheduleEvent helper (platform/scheduling/log-schedule-event.ts,
// safe to import outside Next).
// ---------------------------------------------------------------------------
const MEAL_TIMES: Record<string, string> = {
  breakfast: "07:30:00",
  lunch: "12:30:00",
  dinner: "18:30:00",
  snack: "15:30:00",
};

async function seedScheduleEventsForPlans(
  supabase: AdminClient,
  userId: string,
  weekStarts: string[],
  workoutPlans: Map<string, WorkoutPlanRow>,
  mealPlans: Map<string, MealPlanRow>
): Promise<void> {
  let count = 0;
  for (const weekStart of weekStarts) {
    const weekDates = getWeekDates(weekStart);

    const workoutPlan = workoutPlans.get(weekStart);
    if (workoutPlan) {
      const { data: items } = await supabase
        .from("workout_plan_items")
        .select("day_of_week")
        .eq("workout_plan_id", workoutPlan.id);
      const uniqueDays = new Set((items ?? []).map((i) => i.day_of_week));
      for (const day of uniqueDays) {
        await logScheduleEvent(userId, "workout", "workout", workoutPlan.id, "07:00:00", supabase, "planned", weekDates[day]);
        count++;
      }
    }

    const mealPlan = mealPlans.get(weekStart);
    if (mealPlan) {
      const { data: items } = await supabase
        .from("meal_plan_items")
        .select("day_of_week, meal_type")
        .eq("meal_plan_id", mealPlan.id);
      for (const item of items ?? []) {
        await logScheduleEvent(
          userId,
          "meal",
          item.meal_type,
          mealPlan.id,
          MEAL_TIMES[item.meal_type] ?? "12:00:00",
          supabase,
          "planned",
          weekDates[item.day_of_week]
        );
        count++;
      }
    }
  }
  console.log(`Seeded ${count} schedule_events rows for plan items.`);
}

async function seedCustomTimelineEvents(supabase: AdminClient, userId: string): Promise<void> {
  const events: { date: string; title: string; scheduled_time: string }[] = [
    { date: todayIso(), title: "Call with Mom", scheduled_time: "19:00:00" },
    { date: daysAhead(2), title: "Dentist appointment", scheduled_time: "10:30:00" },
    { date: daysAhead(6), title: "Grocery run", scheduled_time: "11:00:00" },
    { date: daysAhead(7), title: "Meal prep", scheduled_time: "16:00:00" },
    { date: daysAhead(9), title: "Read a book", scheduled_time: "20:30:00" },
    { date: daysAhead(13), title: "Coffee with a friend", scheduled_time: "09:30:00" },
    { date: daysAhead(21), title: "Team offsite", scheduled_time: "09:00:00" },
  ];

  const { error } = await supabase
    .from("custom_timeline_events")
    .insert(events.map((e) => ({ user_id: userId, date: e.date, title: e.title, scheduled_time: e.scheduled_time })));
  if (error) throw error;

  for (const e of events) {
    await logScheduleEvent(
      userId,
      "custom",
      e.title.trim().toLowerCase(),
      userId,
      e.scheduled_time,
      supabase,
      "planned",
      e.date
    );
  }
  console.log(`Seeded ${events.length} custom timeline events.`);
}

// ---------------------------------------------------------------------------
// Trailing history: nutrition/exercise/health metrics/recovery/study/tasks.
// Built into an in-memory day-by-day record first so weekly_reviews.metrics
// can be derived from the same numbers actually written to the DB, instead
// of a second, possibly-inconsistent set of hand-picked values.
// ---------------------------------------------------------------------------
type DayRecord = {
  date: string;
  isToday: boolean;
  isWorkoutDay: boolean;
  workoutCompleted: boolean;
  weightLb: number | null;
  sleepMinutes: number;
  sleepQuality: number;
  steps: number;
  restingHeartRate: number;
  hrv: number | null;
  meals: ("breakfast" | "lunch" | "dinner" | "snack")[];
  nutritionTotals: { calories: number; protein: number };
  recoveryLogged: boolean;
  studyMinutes: number | null;
};

function buildDailyHistory(): DayRecord[] {
  const days: DayRecord[] = [];
  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset--) {
    const date = daysAgo(offset);
    const isToday = offset === 0;
    const dow = dayOfWeek(date);
    const isWorkoutDay = WORKOUT_DAYS.includes(dow) && (isToday || !chance(0.1));
    // Weight trends from START_WEIGHT toward TARGET_WEIGHT over the window.
    const progress = (HISTORY_DAYS - 1 - offset) / (HISTORY_DAYS - 1);
    const trendWeight = START_WEIGHT - (START_WEIGHT - TARGET_WEIGHT) * 0.55 * progress;
    const weightLoggedToday = offset % 3 === 0 || isToday;

    const meals: DayRecord["meals"] = [];
    if (isToday) {
      // Today is partially logged -- breakfast + lunch only, dinner pending.
      meals.push("breakfast", "lunch");
    } else if (!chance(0.12)) {
      meals.push("breakfast", "lunch", "dinner");
      if (chance(0.4)) meals.push("snack");
    }

    days.push({
      date,
      isToday,
      isWorkoutDay,
      workoutCompleted: isWorkoutDay && !isToday,
      weightLb: weightLoggedToday ? randFloat(trendWeight - 1, trendWeight + 1) : null,
      sleepMinutes: randInt(390, 480),
      sleepQuality: randInt(3, 5),
      steps: isToday ? randInt(2000, 5000) : randInt(5500, 11000),
      restingHeartRate: randInt(54, 66),
      hrv: offset % 4 === 0 ? randInt(35, 70) : null,
      meals,
      nutritionTotals: { calories: 0, protein: 0 }, // filled in while writing nutrition_logs
      recoveryLogged: !isToday && chance(0.28),
      studyMinutes: !isToday && chance(0.35) ? randInt(30, 90) : null,
    });
  }
  return days;
}

async function writeHistoricalLogs(
  supabase: AdminClient,
  userId: string,
  days: DayRecord[],
  exercises: ExerciseRow[],
  recipes: Record<"breakfast" | "lunch" | "dinner" | "snack", RecipeRow[]>,
  currentWeekStart: string
): Promise<void> {
  const today = todayIso();
  // Dates in [currentWeekStart, today] get their nutrition_logs written by
  // completeCurrentWeekPastItems instead (recipe-matched to the actual
  // planned meal_plan_item, with completed_at/nutrition_log_id linked) --
  // writing a second, unrelated random entry here would double-count
  // calories/protein for those days and leave the plan item still
  // uncompleted.
  const isHandledByPlanCompletion = (date: string) => date >= currentWeekStart && date <= today;
  const healthMetrics: Database["public"]["Tables"]["health_metrics"]["Insert"][] = [];
  const exerciseLogs: Database["public"]["Tables"]["exercise_logs"]["Insert"][] = [];
  const nutritionLogs: Database["public"]["Tables"]["nutrition_logs"]["Insert"][] = [];
  const recoveryLogs: Database["public"]["Tables"]["recovery_logs"]["Insert"][] = [];
  const studySessions: Database["public"]["Tables"]["study_sessions"]["Insert"][] = [];

  let exerciseCursor = 0;
  for (const day of days) {
    const ts = middayUtc(day.date);

    // Sleep (every day -- the streak backbone) + steps + resting HR.
    healthMetrics.push({
      user_id: userId,
      metric_type: "sleep",
      started_at: ts,
      value: day.sleepMinutes,
      sleep_quality: day.sleepQuality,
      source: "HealthKit",
    });
    healthMetrics.push({ user_id: userId, metric_type: "steps", started_at: ts, value: day.steps, source: "HealthKit" });
    healthMetrics.push({
      user_id: userId,
      metric_type: "resting_heart_rate",
      started_at: ts,
      value: day.restingHeartRate,
      unit: "bpm",
      source: "HealthKit",
    });
    healthMetrics.push({
      user_id: userId,
      metric_type: "heart_rate",
      started_at: ts,
      value: day.restingHeartRate + randInt(5, 15),
      unit: "bpm",
      source: "HealthKit",
    });
    if (day.hrv !== null) {
      healthMetrics.push({
        user_id: userId,
        metric_type: "heart_rate_variability",
        started_at: ts,
        value: day.hrv,
        unit: "ms",
        source: "HealthKit",
      });
    }
    if (day.weightLb !== null) {
      healthMetrics.push({
        user_id: userId,
        metric_type: "weight",
        started_at: ts,
        value: day.weightLb,
        unit: "lb",
        source: day.isToday ? "manual" : "HealthKit",
      });
    }

    if (day.workoutCompleted) {
      const ex = exercises[exerciseCursor % exercises.length];
      exerciseCursor++;
      const durationMinutes = randInt(40, 65);
      const startedAt = `${day.date}T13:00:00.000Z`;
      const endedAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString();
      healthMetrics.push({
        user_id: userId,
        metric_type: "workout",
        started_at: startedAt,
        ended_at: endedAt,
        activity_type: ex.movement_pattern,
        source: "HealthKit",
      });
      exerciseLogs.push({
        user_id: userId,
        date: day.date,
        archetype: "general_fitness",
        duration_minutes: durationMinutes,
        perceived_exertion: randInt(5, 8),
        notes: `${ex.name} focus`,
      });
    }

    for (const meal of day.meals) {
      const pool = recipes[meal];
      const recipe = pick(pool);
      if (!isHandledByPlanCompletion(day.date)) {
        nutritionLogs.push({
          user_id: userId,
          date: day.date,
          meal,
          food: recipe.name,
          quantity: 1,
          unit: "serving",
          calories: recipe.calories,
          protein: recipe.protein_g,
          carbohydrates: recipe.carbs_g,
          fat: recipe.fat_g,
          fiber: recipe.fiber_g,
        });
      }
      day.nutritionTotals.calories += recipe.calories;
      day.nutritionTotals.protein += recipe.protein_g;
    }

    if (day.recoveryLogged) {
      recoveryLogs.push({
        user_id: userId,
        date: day.date,
        pain: randInt(0, 2),
        swelling: randInt(0, 1),
        energy: randInt(3, 5),
        warning_signs: false,
        notes: "Feeling good, no issues.",
      });
    }

    if (day.studyMinutes !== null) {
      studySessions.push({
        user_id: userId,
        date: day.date,
        track: "AI engineering project",
        task: "Worked on personal project",
        duration_minutes: day.studyMinutes,
        focus: randInt(3, 5),
        reflection: "Good progress, made a bit of headway.",
        next_step: "Continue next session.",
      });
    }
  }

  // Batch insert (Supabase handles reasonably large arrays in one call;
  // this repo's own scripts use plain single .insert() calls the same way).
  for (const [name, rows] of [
    ["health_metrics", healthMetrics],
    ["exercise_logs", exerciseLogs],
    ["nutrition_logs", nutritionLogs],
    ["recovery_logs", recoveryLogs],
    ["study_sessions", studySessions],
  ] as const) {
    if (rows.length === 0) continue;
    const { error } = await supabase.from(name).insert(rows as never);
    if (error) throw new Error(`Failed inserting ${name}: ${error.message}`);
  }

  console.log(
    `Seeded ${healthMetrics.length} health_metrics, ${exerciseLogs.length} exercise_logs, ${nutritionLogs.length} nutrition_logs, ${recoveryLogs.length} recovery_logs, ${studySessions.length} study_sessions.`
  );
}

async function seedDailyActions(
  supabase: AdminClient,
  userId: string,
  days: DayRecord[],
  domainIdByKey: Map<string, string>,
  goalIdByOutcome: Map<string, string>
): Promise<void> {
  const nutritionGoalId = goalIdByOutcome.get(demoGoals[0].outcome) ?? null;
  const exerciseGoalId = goalIdByOutcome.get(demoGoals[1].outcome) ?? null;
  const learningGoalId = goalIdByOutcome.get(demoGoals[2].outcome) ?? null;
  const nutritionDomainId = domainIdByKey.get("nutrition") ?? null;
  const exerciseDomainId = domainIdByKey.get("exercise") ?? null;
  const learningDomainId = domainIdByKey.get("learning") ?? null;

  type ActionInsert = Database["public"]["Tables"]["daily_actions"]["Insert"];
  const actions: (ActionInsert & { _tempKey: string })[] = [];

  for (const day of days) {
    const mealCount = day.meals.length;
    const nutritionStatus: ActionInsert["status"] =
      mealCount === 0 ? "skipped" : mealCount < 3 ? "partially_completed" : "completed";
    actions.push({
      _tempKey: `${day.date}-nutrition`,
      user_id: userId,
      date: day.date,
      domain_id: nutritionDomainId,
      goal_id: nutritionGoalId,
      title: "Log today's meals",
      is_required: true,
      priority: 1,
      status: nutritionStatus,
      skip_reason: nutritionStatus === "skipped" ? "Long day, forgot to log" : null,
      source: "ai_generated",
    });

    if (day.isWorkoutDay) {
      actions.push({
        _tempKey: `${day.date}-exercise`,
        user_id: userId,
        date: day.date,
        domain_id: exerciseDomainId,
        goal_id: exerciseGoalId,
        title: "Complete today's workout",
        is_required: true,
        priority: 1,
        status: day.workoutCompleted ? "completed" : "planned",
        source: "ai_generated",
      });
    }

    if (day.studyMinutes !== null) {
      actions.push({
        _tempKey: `${day.date}-learning`,
        user_id: userId,
        date: day.date,
        domain_id: learningDomainId,
        goal_id: learningGoalId,
        title: "Study session",
        is_required: false,
        priority: 2,
        status: "completed",
        source: "manual",
      });
    }
  }

  const inserted: { id: string; status: string }[] = [];
  const CHUNK = 200;
  for (let i = 0; i < actions.length; i += CHUNK) {
    const chunk = actions.slice(i, i + CHUNK).map(({ _tempKey, ...rest }) => rest);
    const { data, error } = await supabase.from("daily_actions").insert(chunk).select("id, status");
    if (error) throw error;
    inserted.push(...(data ?? []));
  }

  const events = inserted.map((row) => ({
    user_id: userId,
    action_id: row.id,
    from_status: "planned" as const,
    to_status: row.status,
    reason: null,
  }));
  if (events.length > 0) {
    const { error } = await supabase.from("action_events").insert(events);
    if (error) throw error;
  }

  console.log(`Seeded ${inserted.length} daily_actions with action_events.`);
}

async function recomputeSummaries(supabase: AdminClient, userId: string, days: DayRecord[]): Promise<void> {
  for (const day of days) {
    await recomputeActivityDailySummaryForDay(supabase, userId, day.date);
  }
  console.log(`Recomputed activity_daily_summaries for ${days.length} days.`);
}

/**
 * Approved nutrition generated_parameters -- without these,
 * getApprovedParameterValue(userId, "nutrition", ...) returns null
 * everywhere it's read (domains/review/metrics.ts's calorieAdherencePercent,
 * domains/review/energy-balance.ts's BMR fallback), silently blanking out
 * both regardless of how much other data is seeded. Hand-authored rather
 * than run through the real Mifflin-St Jeor engine (same "good enough
 * fidelity for a demo account" tradeoff the rest of this script makes) --
 * maintenance_calories set above CALORIE_TARGET, consistent with the
 * fat-loss goal (eating in a deficit relative to maintenance).
 */
async function seedApprovedNutritionParameters(supabase: AdminClient, userId: string): Promise<void> {
  const params = [
    { name: "calorie_target", value: CALORIE_TARGET, unit: "kcal" },
    { name: "protein_target_g", value: PROTEIN_TARGET, unit: "g" },
    { name: "maintenance_calories", value: 2450, unit: "kcal" },
  ];
  const { error } = await supabase.from("generated_parameters").insert(
    params.map((p) => ({
      user_id: userId,
      domain: "nutrition",
      name: p.name,
      value: p.value,
      unit: p.unit,
      source: "calculation" as const,
      rationale: "Demo seed data.",
      confidence: 1,
      requires_user_approval: true,
      approved: true,
      approved_at: new Date().toISOString(),
    }))
  );
  if (error) throw error;
  console.log(`Seeded ${params.length} approved nutrition parameters.`);
}

// ---------------------------------------------------------------------------
// weekly_outcomes (past weeks) + one fully-populated weekly_reviews row for
// last week (status 'approved', real metrics + a hand-authored but
// schema-valid WeeklyBrief -- not run through the real LLM pipeline).
// writeOnboardingOutput already created this week's 'proposed' weekly_outcomes
// row from the onboarding output, so only past weeks are added here.
// ---------------------------------------------------------------------------
/**
 * Builds one weekly_reviews row (real metrics derived from the given
 * day-offset window's already-seeded DayRecords, plus a hand-authored but
 * schema-valid WeeklyBrief) and upserts it. `weekStart` must match
 * domains/review/dates.ts#reviewWeekStart's rolling-7-day-ending-today
 * scheme (today - 6, NOT a Sunday-aligned calendar week -- the review
 * engine never uses calendar weeks, only meal/workout plans do), or the
 * app will never actually surface whichever row this writes: the API
 * always looks up (user_id, reviewWeekStart()), not "the most recent row."
 */
async function seedOneWeeklyReview(
  supabase: AdminClient,
  userId: string,
  days: DayRecord[],
  goalIdByOutcome: Map<string, string>,
  offsetStart: number,
  offsetEnd: number,
  weekStart: string,
  isCurrentWeek: boolean
): Promise<void> {
  const weekDays = days.filter((d) => {
    const offsetDays = Math.round((Date.parse(`${todayIso()}T00:00:00Z`) - Date.parse(`${d.date}T00:00:00Z`)) / 86400000);
    return offsetDays >= offsetStart && offsetDays <= offsetEnd;
  });

  const weightValues = weekDays.map((d) => d.weightLb).filter((v): v is number => v !== null);
  const weightChangeLb =
    weightValues.length >= 2 ? Math.round((weightValues[weightValues.length - 1] - weightValues[0]) * 10) / 10 : null;
  const averageWeightThisWeek =
    weightValues.length > 0 ? Math.round((weightValues.reduce((a, b) => a + b, 0) / weightValues.length) * 10) / 10 : null;
  const loggedNutritionDays = weekDays.filter((d) => d.meals.length > 0).length;
  const avgCalories = weekDays.reduce((sum, d) => sum + d.nutritionTotals.calories, 0) / Math.max(1, loggedNutritionDays);
  const avgProtein = weekDays.reduce((sum, d) => sum + d.nutritionTotals.protein, 0) / Math.max(1, loggedNutritionDays);
  const avgSleep = Math.round(weekDays.reduce((sum, d) => sum + d.sleepMinutes, 0) / weekDays.length);
  const learningMinutes = weekDays.reduce((sum, d) => sum + (d.studyMinutes ?? 0), 0);
  const workoutsCompleted = weekDays.filter((d) => d.workoutCompleted).length;

  const metrics = {
    weekStart,
    weightChangeLb,
    averageWeightThisWeek,
    proteinAdherencePercent: Math.round((avgProtein / PROTEIN_TARGET) * 100),
    calorieAdherencePercent: Math.round((avgCalories / CALORIE_TARGET) * 100),
    nutritionLoggingDays: loggedNutritionDays,
    averageSleepMinutes: avgSleep,
    recoveryLoggingDays: weekDays.filter((d) => d.recoveryLogged).length,
    painTrend: "stable" as const,
    swellingTrend: "stable" as const,
    averagePainThisWeek: 1,
    averageSwellingThisWeek: 0.5,
    learningMinutes,
    taskCompletionPercent: 85,
    missedTaskReasons: [] as string[],
    isDataSparse: loggedNutritionDays < 3,
  };

  // v3 brief shape (2026-08-12 redesign): flowing paragraph narrative
  // instead of separate headlineInsight/executiveSummary/correlationNarrative/
  // achievementNote/whatWorked/whatNeedsImprovement/progress/risks fields --
  // see domains/review/brief-schema.ts for the real schema this mirrors.
  const brief = {
    narrative: [
      `${workoutsCompleted} of ${WORKOUT_DAYS.length} planned workouts done this week, and your weight is trending toward the **${TARGET_WEIGHT} lb** goal${averageWeightThisWeek !== null ? ` (averaging ${averageWeightThisWeek} lb)` : ""} -- ${isCurrentWeek ? "a strong week so far" : "your most consistent week yet"}. Days you slept 7+ hours were consistently followed by higher-quality logged workouts the next day, a pattern worth protecting as training ramps up.`,
      `Nutrition logging was solid most days, though *dinner* slipped on a couple of busier evenings and protein came in under target twice. Learning minutes dipped slightly too -- worth protecting a block for it this week if the schedule allows.`,
    ],
    priorities: [
      { title: "Log dinner consistently", reason: "A couple of evenings were missed this week", domain: "nutrition", priority: 1 as const },
      { title: "Keep the 5-day training rhythm going", reason: "Adherence has been strong, don't lose momentum", domain: "exercise", priority: 2 as const },
      { title: "Protect a weekly project block", reason: "Learning minutes dipped slightly", domain: "learning", priority: 3 as const },
    ],
    changes: [
      {
        field: "protein_target",
        previousValue: PROTEIN_TARGET,
        proposedValue: PROTEIN_TARGET,
        reason: "Current target is working well, no change needed.",
        confidence: 0.7,
      },
    ],
    highestLeverageAction: "**Log dinner consistently this week** to close the adherence gap before it compounds.",
    weeklyMottoId: "roosevelt_dare",
  };

  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      metrics,
      answers: {
        wins: "Hit most workouts and stayed close to my calorie target most days.",
        challenges: "Struggled to log dinner on busier nights.",
        nextWeekFocus: "Keep prepping lunches ahead of time.",
      },
      brief,
      // AISummary.tsx (mobile) and the web brief page both special-case
      // status "approved" as a plain "this week's plan is active"
      // confirmation card that deliberately does NOT re-render the brief
      // (see that file's own comment: a user who already approved it
      // already read it). The rich brief UI only renders for status
      // "generated" (awaiting approval). Seed the current week as
      // "generated" so opening AI Summary actually shows the brief;
      // "approved" is correct for the *previous* week (a real user's
      // most recent completed cycle), which isn't rendered by any screen
      // anyway -- it only feeds streak/comparison history.
      status: isCurrentWeek ? ("generated" as const) : ("approved" as const),
      approved_at: isCurrentWeek ? null : new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" }
  );
  if (error) throw error;
}

async function seedWeeklyOutcomesAndReview(
  supabase: AdminClient,
  userId: string,
  days: DayRecord[],
  goalIdByOutcome: Map<string, string>
): Promise<void> {
  const nutritionGoalId = goalIdByOutcome.get(demoGoals[0].outcome) ?? null;
  const exerciseGoalId = goalIdByOutcome.get(demoGoals[1].outcome) ?? null;

  const pastOutcomes = [
    { weeksAgo: 1, goalId: nutritionGoalId, text: "Hit calorie target at least 5 days this week", status: "completed" as const },
    { weeksAgo: 1, goalId: exerciseGoalId, text: "Complete all 5 planned workouts", status: "completed" as const },
    { weeksAgo: 2, goalId: nutritionGoalId, text: "Log every meal for 6 of 7 days", status: "active" as const },
  ];
  for (const outcome of pastOutcomes) {
    const weekStart = getWeekDates(daysAgo(outcome.weeksAgo * 7))[0];
    const { error } = await supabase.from("weekly_outcomes").insert({
      user_id: userId,
      goal_id: outcome.goalId,
      week_start: weekStart,
      outcome_text: outcome.text,
      status: outcome.status,
    });
    if (error) throw error;
  }

  // domains/review/dates.ts#reviewWeekStart is a rolling 7-day window
  // ending today (today - 6), never a Sunday-aligned calendar week --
  // getOrCreateWeeklyReview always looks up exactly that week_start, so an
  // "approved brief" seeded under any other date (e.g. the Sunday-aligned
  // scheme meal/workout plans use) would silently never be shown by the
  // app. Seed both the current rolling week (so AI Summary shows a fully
  // populated, approved brief immediately -- no need to wait for or
  // fake-trigger the real weekly cron) and the one before it (so
  // week-over-week comparisons, streak history, and closed-loop experiment
  // evaluation all have a real previous week to compare against).
  const currentWeekStart = daysAgo(6);
  const previousWeekStart = daysAgo(13);
  await seedOneWeeklyReview(supabase, userId, days, goalIdByOutcome, 0, 6, currentWeekStart, true);
  await seedOneWeeklyReview(supabase, userId, days, goalIdByOutcome, 7, 13, previousWeekStart, false);

  console.log(
    `Seeded ${pastOutcomes.length} past weekly_outcomes and two weekly_reviews rows (current: ${currentWeekStart}, status generated; previous: ${previousWeekStart}, status approved).`
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function buildWeekStarts(): string[] {
  const thisWeekStart = getWeekDates(todayIso())[0];
  return Array.from({ length: FORWARD_WEEKS }, (_, i) => addDateStr(thisWeekStart, i * 7));
}

async function main() {
  if (process.env.ALLOW_SEED !== "true") {
    console.error(
      "Refusing to seed: set ALLOW_SEED=true in .env.local to run this script.\n" +
        "This writes to the same Supabase project as production -- data is fully isolated by user_id."
    );
    process.exit(1);
  }

  const supabase = createScriptAdminClient();

  const userId = await getOrCreateDemoUser(supabase);
  await wipeExistingData(supabase, userId);

  const { goalIdByOutcome, domainIdByKey } = await seedIdentityGoalsOnboarding(supabase, userId);

  const [exercises, recipes] = await Promise.all([loadExercises(supabase), loadRecipes(supabase)]);
  const weekStarts = buildWeekStarts();

  const recipeById = new Map(
    [...recipes.breakfast, ...recipes.lunch, ...recipes.dinner, ...recipes.snack].map((r) => [r.id, r])
  );

  const workoutPlans = await seedWorkoutPlans(supabase, userId, weekStarts, exercises);
  const mealPlans = await seedMealPlans(supabase, userId, weekStarts, recipes);
  await seedGroceryAndPrep(supabase, userId, weekStarts[0], mealPlans.get(weekStarts[0])!, recipes);
  await seedScheduleEventsForPlans(supabase, userId, weekStarts, workoutPlans, mealPlans);
  await seedCustomTimelineEvents(supabase, userId);

  const days = buildDailyHistory();
  await writeHistoricalLogs(supabase, userId, days, exercises, recipes, weekStarts[0]);
  await completeCurrentWeekPastItems(
    supabase,
    userId,
    weekStarts[0],
    mealPlans.get(weekStarts[0])!,
    workoutPlans.get(weekStarts[0])!,
    recipeById
  );
  await seedDailyActions(supabase, userId, days, domainIdByKey, goalIdByOutcome);
  await recomputeSummaries(supabase, userId, days);
  await seedApprovedNutritionParameters(supabase, userId);
  await seedWeeklyOutcomesAndReview(supabase, userId, days, goalIdByOutcome);

  console.log("\nDemo seed complete.");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(
    "\nKnown gaps (not fixable by seeding Supabase): Settings -> Health Sync's live on-device HealthKit preview, and real Calendar OAuth connection status."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
