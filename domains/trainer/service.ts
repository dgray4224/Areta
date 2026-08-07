"use server";

import { randomBytes } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { requireTrainer } from "@/platform/auth/trainer";
import { requireUser } from "@/platform/auth/session";
import { logAdminAction } from "@/platform/audit/log";
import {
  getApprovedParameterValue,
  getGeneratedParameters,
  approveAllGeneratedParameters,
  getNutritionCalculationBaseInputs,
  type StoredParameter,
} from "@/domains/parameters/service";
import { calculateNutritionParameters } from "@/domains/parameters/nutrition-calc";
import type { GeneratedParameter } from "@/domains/parameters/types";
import { getMealPlanForWeek, type MealPlanView } from "@/domains/mealplan/service";
import {
  getCurrentWorkoutPlan,
  approveWorkoutPlan,
  customizeWorkoutPlanItemExercise,
  addWorkoutPlanItemExercise,
  type WorkoutPlanView,
  type WorkoutPlanItemView,
  type CustomizeExerciseInput,
} from "@/domains/workoutplan/service";
import { getFirstPhase, getHydratedPhasesForProgram } from "@/domains/trainerprogram/service";
import {
  generateAndSaveFromTrainerProgram,
  generateAndApproveWeeksThrough,
  materializeWeekContaining,
} from "@/domains/trainerprogram/materialize";
import { projectProgramRange, addDays, sundayOfWeekContaining } from "@/domains/trainerprogram/calendar-projection";
import {
  setDateOverride,
  clearDateOverride,
  getOverridesForRange,
  type OverrideExerciseInput,
} from "@/domains/trainerprogram/overrides";
import { resolveMealProgramPhase } from "@/domains/trainermealprogram/phase-resolution";
import { getMealPortionRows } from "@/domains/trainermealprogram/portions";
import { materializeCurrentMealWeek, archiveStaleTrainerMealPlans } from "@/domains/trainermealprogram/materialize";
import type { ActionResult } from "@/platform/auth/actions";
import type { Database } from "@/platform/db/types";
import type {
  TrainerClientSummary,
  InviteCode,
  ClientHistorySummary,
  ClientGoal,
  MyTrainerInfo,
  TrainerProfile,
  DiscoverableTrainer,
  MyTrainerRequest,
  IncomingTrainerRequest,
} from "@/domains/trainer/types";
import type { TrainerProgramAssignment, PastAssignment } from "@/domains/trainerprogram/types";
import type {
  TrainerMealProgramAssignment,
  PastMealAssignment,
  MealPortionRow,
  NutritionOverride,
} from "@/domains/trainermealprogram/types";

/** Shared guard for every trainer action that touches a specific client's
 * data — re-verifies the trainer_clients relationship server-side before
 * calling any generate/approve/edit function below, on top of the RLS
 * policies (migration 0066) that are the real backstop either way. Every
 * domain function this calls into (generateAndSaveMealPlan,
 * approveWorkoutPlan, etc.) takes a plain userId and trusts RLS rather
 * than deriving identity from the caller's own session — same convention
 * this file already uses, and exactly why this check has to happen here
 * instead of inside those functions. */
async function requireActiveClient(
  trainerId: string,
  clientId: string,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data } = await supabase
    .from("trainer_clients")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

/** Every profiles.full_name lookup in this file goes through this RPC
 * (migration 0072), never a direct `.from("profiles").select(...)` —
 * profiles has no row-level SELECT policy granting cross-user access
 * anymore (dropped in 0072, over-exposed every column, not just the
 * name this app actually needs). get_visible_profile_names is
 * SECURITY DEFINER and column-scoped by construction: it can only ever
 * return full_name, regardless of what profiles gains in the future. */
async function getVisibleNames(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.rpc("get_visible_profile_names", { target_ids: ids });
  return new Map((data ?? []).map((row) => [row.id, row.full_name]));
}

/** Thin wrapper over logAdminAction for the trainer-on-client-data
 * actions below — same admin_actions table, so an owner can see trainer
 * activity in the same Ops → Audit log as everything else, not a
 * separate trail. targetType is always "trainer_client_data" with the
 * clientId in detail rather than as targetId, since these actions don't
 * touch trainer_clients itself (see trainer_invite_redeemed/
 * trainer_relationship_ended above for the ones that do). */
async function logTrainerAction(
  trainer: User,
  action: string,
  clientId: string,
  detail: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    actorId: trainer.id,
    actorEmail: trainer.email ?? null,
    action,
    targetType: "trainer_client_data",
    targetId: null,
    detail: { clientId, ...detail },
  });
}

// Excludes visually ambiguous characters (0/O, 1/I/L) since a client has
// to type this in by hand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Trainer side — all via the regular RLS-scoped client. Every query here
// is only ever able to see rows the migration 0066/0067 policies already
// grant a trainer for their own codes / their own active clients; nothing
// below is a substitute for that RLS, just app-level ergonomics on top.
// ---------------------------------------------------------------------------

export async function listMyClients(): Promise<TrainerClientSummary[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  const { data: relationships, error } = await supabase
    .from("trainer_clients")
    .select("id, client_id, started_at")
    .eq("trainer_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false });
  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  if (!relationships || relationships.length === 0) return [];

  const clientIds = relationships.map((r) => r.client_id);
  const nameById = await getVisibleNames(supabase, clientIds);

  return relationships.map((r) => ({
    relationshipId: r.id,
    clientId: r.client_id,
    fullName: nameById.get(r.client_id) ?? null,
    startedAt: r.started_at,
  }));
}

export async function generateInviteCode(): Promise<ActionResult<{ code: string }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  // A handful of retries in case of a random collision against the
  // table's unique constraint — astronomically unlikely at this scale
  // (32^8 possibilities) but cheap to guard anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("trainer_invite_codes")
      .insert({
        trainer_id: user.id,
        code,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (!error && data) {
      await logAdminAction({
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: "trainer_invite_code_generated",
        targetType: "trainer_invite_code",
        targetId: data.id,
        detail: null,
      });
      return { ok: true, data: { code } };
    }
    if (!error?.message.includes("duplicate")) return { ok: false, error: error?.message ?? "Unknown error" };
  }
  return { ok: false, error: "Could not generate a unique code — try again." };
}

export async function listMyInviteCodes(): Promise<InviteCode[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trainer_invite_codes")
    .select("id, code, created_at, expires_at, used_at, used_by, revoked_at")
    .eq("trainer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load invite codes: ${error.message}`);

  const usedByIds = (data ?? []).map((c) => c.used_by).filter((id): id is string => !!id);
  const nameById = await getVisibleNames(supabase, usedByIds);

  return (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    createdAt: c.created_at,
    expiresAt: c.expires_at,
    usedAt: c.used_at,
    usedByName: c.used_by ? (nameById.get(c.used_by) ?? null) : null,
    revokedAt: c.revoked_at,
  }));
}

export async function revokeInviteCode(id: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_invite_code_revoked",
    targetType: "trainer_invite_code",
    targetId: id,
    detail: null,
  });

  return { ok: true, data: undefined };
}

/** Not just an RLS-trusting query — is_trainer_of is re-checked here
 * explicitly before touching any client table, so a trainer who somehow
 * guesses another trainer's client's id gets a clean "not your client"
 * error instead of four separate empty-result queries that look like a
 * bug. RLS is still the real backstop underneath this either way. */
export async function getClientHistorySummary(clientId: string): Promise<ActionResult<ClientHistorySummary>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const [weightRes, sleepRes, nutritionRes, recoveryRes, goalsRes, nameById] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("id, logged_at, weight, unit")
      .eq("user_id", clientId)
      .order("logged_at", { ascending: false })
      .limit(5),
    supabase
      .from("sleep_logs")
      .select("id, date, total_duration_minutes, quality")
      .eq("user_id", clientId)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("nutrition_logs")
      .select("id, date, meal, food, calories")
      .eq("user_id", clientId)
      .order("date", { ascending: false })
      .limit(10),
    supabase
      .from("recovery_logs")
      .select("id, date, pain, energy")
      .eq("user_id", clientId)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("goals")
      .select("id, outcome, why, target_date, priority, confidence, status")
      .eq("user_id", clientId)
      .order("priority", { ascending: true, nullsFirst: false }),
    getVisibleNames(supabase, [clientId]),
  ]);

  const summary: ClientHistorySummary = {
    clientName: nameById.get(clientId) ?? null,
    recentWeightLogs: (weightRes.data ?? []).map((r) => ({
      id: r.id,
      loggedAt: r.logged_at,
      weight: r.weight,
      unit: r.unit,
    })),
    recentSleepLogs: (sleepRes.data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      totalDurationMinutes: r.total_duration_minutes,
      quality: r.quality,
    })),
    recentNutritionLogs: (nutritionRes.data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      meal: r.meal,
      food: r.food,
      calories: r.calories,
    })),
    recentRecoveryLogs: (recoveryRes.data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      pain: r.pain,
      energy: r.energy,
    })),
    goals: (goalsRes.data ?? []).map(
      (g): ClientGoal => ({
        id: g.id,
        outcome: g.outcome,
        why: g.why,
        targetDate: g.target_date,
        priority: g.priority,
        confidence: g.confidence,
        status: g.status as ClientGoal["status"],
      })
    ),
  };

  return { ok: true, data: summary };
}

/** The one write path this pass ships end-to-end (status/priority only —
 * full nutrition-parameter and workout-plan editors are the deliberate
 * next step, not built yet; the RLS underneath already supports both,
 * see migration 0066). Re-checks is_trainer_of before writing, same
 * reasoning as getClientHistorySummary. */
export async function updateClientGoal(
  goalId: string,
  clientId: string,
  input: { status?: "active" | "achieved" | "abandoned"; priority?: number | null }
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { error } = await supabase
    .from("goals")
    .update({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    })
    .eq("id", goalId)
    .eq("user_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logTrainerAction(user, "client_goal_updated", clientId, { goalId, ...input });
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Nutrition and workout customization. Deliberately reuses the exact same
// deterministic generate/approve pipeline the client uses on themselves
// (domains/mealplan, domains/workoutplan, domains/parameters) rather than
// hand-editing plan rows — a trainer regenerating/approving a plan runs
// the same vetted engine, just on a client's behalf.
// ---------------------------------------------------------------------------

export type ClientNutritionOverview = {
  calorieTarget: number | null;
  proteinTarget: number | null;
  /** Every generated_parameters row in the nutrition domain, approved or
   * not — lets the trainer nutrition page show "3 targets awaiting
   * approval" and offer to approve them, distinct from calorieTarget/
   * proteinTarget above (which are null until approved). */
  parameters: StoredParameter[];
  mealPlan: MealPlanView | null;
};

export async function getClientNutritionOverview(
  clientId: string
): Promise<ActionResult<ClientNutritionOverview>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const [calorieTarget, proteinTarget, parameters, mealPlan] = await Promise.all([
    getApprovedParameterValue(clientId, "nutrition", "calorie_target"),
    getApprovedParameterValue(clientId, "nutrition", "protein_target_g"),
    getGeneratedParameters(clientId, "nutrition"),
    // getMealPlanForWeek, not getActiveMealPlan (status='active' only) —
    // found in the third code-review pass: generateAndSaveMealPlan always
    // inserts status:"draft", so getActiveMealPlan could never see a
    // plan the trainer had just generated, and the Approve action was
    // unreachable. Matches app/(app)/plan/meals/page.tsx's own pattern.
    getMealPlanForWeek(clientId, undefined, supabase),
  ]);

  return { ok: true, data: { calorieTarget, proteinTarget, parameters, mealPlan } };
}

/** Approves every generated-but-unapproved nutrition parameter as-is (the
 * calculated/rule-derived value LifeOS already produced from the
 * client's onboarding answers) — not a per-value edit. A trainer wanting
 * to override a specific number still needs the client to do that
 * themselves on /plan/parameters; this only delegates the approval step,
 * same values a client would otherwise approve unedited anyway. Requires
 * parameters to already exist (generated during the client's own
 * onboarding/plan setup) — a trainer can't generate them from scratch,
 * since that needs onboarding data only the client has entered.
 *
 * Flagged during the 2026-08-06 code-review pass as in tension with
 * CLAUDE.md rule 24 ("require user approval before generated parameters
 * become active") — raised with the user and confirmed to keep as-is:
 * linking a trainer is itself the client's delegated consent, the same
 * reasoning already applied to trainer-generated meal/workout plans.
 * Not an oversight; a deliberate, confirmed exception. */
export async function approveClientNutritionParameters(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await approveAllGeneratedParameters(clientId, "nutrition");
  if (!result.ok) return result;

  await logTrainerAction(user, "client_nutrition_parameters_approved", clientId, {});
  return { ok: true, data: undefined };
}

// generateClientMealPlan/approveClientMealPlan (the old shared-algorithm
// generate/approve flow) were removed 2026-08-07 when trainer-authored
// nutrition programs (domains/trainermealprogram/) replaced them as the
// trainer-managed-client nutrition path, per the confirmed "replace
// entirely" decision. getMealPlanForWeek above still reads whatever plan
// exists (self-generated or otherwise) for read-only display.

export async function getClientWorkoutOverview(
  clientId: string
): Promise<ActionResult<{ workoutPlan: WorkoutPlanView | null }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  // getCurrentWorkoutPlan (2026-08-06), not getWorkoutPlanForWeek's own
  // exact-today default or the plain getActiveWorkoutPlan -- the trainer
  // needs to see whatever's actually current, whether that's a draft
  // generated today or a still-active plan from earlier in the week that
  // nothing has touched since (see getCurrentWorkoutPlan's own doc
  // comment for the underlying week_start-exact-match gap this closes).
  const workoutPlan = await getCurrentWorkoutPlan(clientId, supabase);
  return { ok: true, data: { workoutPlan } };
}

/** Deliberately no generateClientWorkoutPlan wrapper (removed 2026-08-06)
 * — a trainer can no longer generate a client's workout plan from the
 * shared library. The client would be paying for a program that's just
 * the same free generation their own account already does; a trainer's
 * value is the program they actually author and customize
 * (domains/trainerprogram), not clicking the same button the client
 * could click themselves. generateAndSaveWorkoutPlan's own guard already
 * refuses to run for a trainer-assigned client either way; this is the
 * other half — no UI or Server Action path exists for a trainer to
 * trigger it for anyone.
 *
 * Approval stays, but its reachable surface shrank to one case
 * (2026-08-07): a trainer-program-sourced plan is now always written
 * 'active' directly (materializeWeek), and the item-edit wrappers below
 * no longer demote an active plan back to draft either -- see this
 * function's own doc comment. What's left is a client who isn't
 * currently trainer-assigned but has their own pending self-generated
 * draft (from onboarding or the library) -- CLAUDE.md rule 10 still
 * protects that self-service path, and a trainer viewing that client's
 * page can approve it on their behalf same as before. */
export async function approveClientWorkoutPlan(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await approveWorkoutPlan(clientId, supabase);
  if (result.ok) await logTrainerAction(user, "client_workout_plan_approved", clientId, {});
  return result;
}

/** Free-form replace — see CustomizeExerciseInput's own doc comment in
 * domains/workoutplan/service.ts. Curated "alternates" swap
 * (swapWorkoutPlanItemExercise, mobile-only today via app/api/exercise)
 * isn't wired up here — that needs the same slot-options/equipment
 * filtering app/api/exercise/route.ts's GET handler does, which is a
 * bigger lift than a free-pick replace; deliberately out of scope for
 * this pass.
 *
 * Writes straight to the client's plan with no re-approval step
 * (2026-08-07, previously demoted the plan back to 'draft' after every
 * trainer edit under CLAUDE.md rule 10 -- removed on the founder's
 * explicit call: rule 10 protects a user's *own* self-service plan
 * generation, not a trainer acting on a client who already consented to
 * that trainer's access by accepting them). */
export async function customizeClientWorkoutItem(
  clientId: string,
  itemId: string,
  input: CustomizeExerciseInput
): Promise<ActionResult<WorkoutPlanItemView>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await customizeWorkoutPlanItemExercise(clientId, itemId, input, supabase);
  if (!result.ok) return result;

  await logTrainerAction(user, "client_workout_item_customized", clientId, { itemId, ...input });
  return result;
}

export async function addClientWorkoutItem(
  clientId: string,
  dayOfWeek: number,
  input: CustomizeExerciseInput
): Promise<ActionResult<WorkoutPlanItemView>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await addWorkoutPlanItemExercise(clientId, dayOfWeek, input, supabase);
  if (!result.ok) return result;

  await logTrainerAction(user, "client_workout_item_added", clientId, { dayOfWeek, ...input });
  return result;
}

// ---------------------------------------------------------------------------
// Trainer-authored programs (2026-08-06) — assigning one of the trainer's
// own domains/trainerprogram programs to a client, the default workout
// view for a trainer's client page now. Authoring itself (create program/
// phase/session/exercise) lives in domains/trainerprogram/service.ts,
// since it's not client-scoped — these are the only trainer-program
// functions that need requireActiveClient.
// ---------------------------------------------------------------------------

/** Archives this client's still-current (today-or-future) workout_plans
 * rows that belong to a trainer program they're no longer on -- called
 * right after a program switch or unassign actually commits. Found
 * 2026-08-07: getWorkoutPlanForWeek's exact-today match has no idea
 * which trainer_program_id a row belongs to, only its date, so a
 * leftover 'active' row materialized under the OLD program before the
 * switch keeps getting served as "today's plan" forever -- most visibly
 * when the NEW program hasn't started yet (generateAndSaveFromTrainerProgram
 * no-ops until then, so nothing ever overwrites the stale row). Scoped
 * to today-or-future dates only, same "don't rewrite history" boundary
 * the rest of this file uses (e.g. validateEditableDate) -- what already
 * happened stays untouched. 'archived' (a workout_plans status the
 * schema has allowed since migration 0010 but nothing ever set) is what
 * makes getWorkoutPlanForWeek stop returning the row, without deleting
 * it. */
async function archiveStaleTrainerProgramPlans(
  clientId: string,
  trainerProgramId: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("workout_plans")
    .update({ status: "archived" })
    .eq("user_id", clientId)
    .eq("trainer_program_id", trainerProgramId)
    .gte("week_start", today)
    .neq("status", "archived");
}

/** end_date and goalOutcome are both required (2026-08-06: "every time a
 * trainer sets a program, they need to specify the start and end date,
 * the tangible goals") — enforced here, not the database (migration
 * 0078's own comment explains why the columns themselves stay nullable).
 * goalOutcome becomes a real goals-table row (domain=exercise, so it
 * shows up alongside the client's own goals, filtered to the same
 * fitness-relevant/active view a trainer already sees — migration 0077),
 * not just a label on the assignment. */
export async function assignProgramToClient(
  clientId: string,
  programId: string,
  startsOn: string,
  endDate: string,
  goalOutcome: string
): Promise<ActionResult<{ warnings: string[] }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const resolvedStartsOn = startsOn || new Date().toISOString().slice(0, 10);
  const trimmedGoal = goalOutcome.trim();
  if (!trimmedGoal) return { ok: false, error: "State a tangible goal for this program." };
  if (!endDate) return { ok: false, error: "Set an end date for this program." };
  if (endDate <= resolvedStartsOn) return { ok: false, error: "End date must be after the start date." };

  const { data: programRow } = await supabase
    .from("trainer_programs")
    .select("id, trainer_id, status")
    .eq("id", programId)
    .maybeSingle();
  if (!programRow || programRow.trainer_id !== user.id) {
    return { ok: false, error: "Program not found." };
  }
  // Also enforced by only listing published programs in the assign UI,
  // but checked again here since a draft (including one an AI import
  // just created, before the trainer has reviewed it) must never reach a
  // client via a direct action call either.
  if (programRow.status !== "published") {
    return { ok: false, error: "Publish this program before assigning it." };
  }

  const firstPhase = await getFirstPhase(programId, supabase);
  if (!firstPhase) {
    return { ok: false, error: "Add at least one phase to this program before assigning it." };
  }

  // Find or create the client's "exercise" domain to hang the goal off
  // of -- not every onboarding path is guaranteed to have created one in
  // advance. A plain select-then-insert rather than an upsert so an
  // already-existing domain's label/is_active never gets silently
  // overwritten by this unrelated flow.
  const { data: existingDomain } = await supabase
    .from("domains")
    .select("id")
    .eq("user_id", clientId)
    .eq("key", "exercise")
    .maybeSingle();

  let domainId = existingDomain?.id;
  if (!domainId) {
    const { data: newDomain, error: domainError } = await supabase
      .from("domains")
      .insert({ user_id: clientId, key: "exercise", label: "Exercise" })
      .select("id")
      .single();
    if (domainError || !newDomain) {
      return { ok: false, error: `Couldn't set up the client's exercise goals: ${domainError?.message}` };
    }
    domainId = newDomain.id;
  }

  const { data: goalRow, error: goalError } = await supabase
    .from("goals")
    .insert({ user_id: clientId, domain_id: domainId, outcome: trimmedGoal, target_date: endDate, status: "active" })
    .select("id")
    .single();
  if (goalError || !goalRow) {
    return { ok: false, error: `Couldn't create the linked goal: ${goalError?.message}` };
  }

  // End any existing active assignment for this client first — the
  // partial unique index (one active assignment per client, migration
  // 0075) would otherwise reject the new insert. Switching programs
  // deliberately doesn't require a separate "unassign" step first.
  // Recorded by id (not just "ended") so a failed insert below can
  // reactivate exactly this row rather than leaving the client with no
  // active assignment at all — found in code review, 2026-08-06: two
  // sequential writes with no real transaction at this layer means a
  // failure between them previously stranded the client program-less.
  const { data: previousActive } = await supabase
    .from("trainer_program_assignments")
    .select("id, program_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (previousActive) {
    const { error: endError } = await supabase
      .from("trainer_program_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", previousActive.id);
    if (endError) return { ok: false, error: endError.message };
  }

  const { error: insertError } = await supabase.from("trainer_program_assignments").insert({
    program_id: programId,
    trainer_id: user.id,
    client_id: clientId,
    starts_on: resolvedStartsOn,
    end_date: endDate,
    goal_outcome: trimmedGoal,
    linked_goal_id: goalRow.id,
  });
  if (insertError) {
    if (previousActive) {
      await supabase
        .from("trainer_program_assignments")
        .update({ status: "active", ended_at: null })
        .eq("id", previousActive.id);
    }
    // Can't delete a client's goal (trainers never get that permission,
    // by design), so soft-clean the orphan instead of leaving it looking
    // like a real active goal with nothing behind it.
    await supabase.from("goals").update({ status: "abandoned" }).eq("id", goalRow.id);
    return { ok: false, error: insertError.message };
  }

  // Clean up the OLD program's leftovers now that the switch actually
  // committed -- see archiveStaleTrainerProgramPlans's own doc comment
  // for why this can't wait on generateAndSaveFromTrainerProgram below
  // to overwrite it naturally (it won't, if the new program hasn't
  // started yet).
  if (previousActive) {
    await archiveStaleTrainerProgramPlans(clientId, previousActive.program_id, supabase);
  }

  // A no-op (with an explanatory warning, not an error) if startsOn is in
  // the future — generateAndSaveFromTrainerProgram itself checks that.
  // Its warnings are surfaced here rather than discarded (found in code
  // review, 2026-08-06) — a future-dated assignment previously reported
  // bare success with no indication nothing was actually generated yet.
  const generated = await generateAndSaveFromTrainerProgram(clientId, supabase);
  if (!generated.ok) return generated;

  await logTrainerAction(user, "client_program_assigned", clientId, {
    programId,
    startsOn,
    endDate,
  });
  return { ok: true, data: { warnings: generated.data.warnings } };
}

export async function unassignProgram(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: activeAssignment } = await supabase
    .from("trainer_program_assignments")
    .select("id, program_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  const { error } = await supabase
    .from("trainer_program_assignments")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  if (activeAssignment) {
    await archiveStaleTrainerProgramPlans(clientId, activeAssignment.program_id, supabase);
  }

  await logTrainerAction(user, "client_program_unassigned", clientId, {});
  return { ok: true, data: undefined };
}

async function loadAssignmentView(
  clientId: string,
  supabase: SupabaseClient<Database>
): Promise<TrainerProgramAssignment | null> {
  const { data: row } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!row) return null;

  const [{ data: programRow }, phases] = await Promise.all([
    supabase.from("trainer_programs").select("name").eq("id", row.program_id).maybeSingle(),
    getHydratedPhasesForProgram(row.program_id, supabase),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const [todayProjection] =
    phases.length > 0 && row.starts_on <= today
      ? projectProgramRange({
          startsOn: row.starts_on,
          endDate: row.end_date,
          phases,
          rangeStart: today,
          rangeEnd: today,
          overridesByDate: new Map(),
        })
      : [];

  return {
    id: row.id,
    programId: row.program_id,
    programName: programRow?.name ?? "Untitled program",
    trainerId: row.trainer_id,
    clientId: row.client_id,
    status: row.status as TrainerProgramAssignment["status"],
    startsOn: row.starts_on,
    endDate: row.end_date,
    goalOutcome: row.goal_outcome,
    currentPhaseName: todayProjection?.phaseName ?? null,
    currentWeekInPhase: todayProjection?.weekInPhase ?? null,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export async function getClientProgramAssignment(clientId: string): Promise<TrainerProgramAssignment | null> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) return null;
  return loadAssignmentView(clientId, supabase);
}

/** Ended assignments are never deleted (2026-08-06: "programs should stay
 * in archive with the trainer having the ability to recycle it again") --
 * this is that archive. Reassigning is just AssignProgramForm again,
 * pre-filled from one of these entries; no separate "recycle" action or
 * schema needed, since editing the program itself (before reassigning)
 * is how "with modifications" happens. */
export async function listClientAssignmentHistory(clientId: string): Promise<ActionResult<PastAssignment[]>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: rows, error } = await supabase
    .from("trainer_program_assignments")
    .select("id, program_id, starts_on, end_date, goal_outcome, status, started_at, ended_at")
    .eq("client_id", clientId)
    .eq("status", "ended")
    .order("started_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) return { ok: true, data: [] };

  const programIds = Array.from(new Set(rows.map((r) => r.program_id)));
  const { data: programRows } = await supabase.from("trainer_programs").select("id, name").in("id", programIds);
  const nameById = new Map((programRows ?? []).map((p) => [p.id, p.name]));

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      programId: r.program_id,
      programName: nameById.get(r.program_id) ?? "Untitled program",
      startsOn: r.starts_on,
      endDate: r.end_date,
      goalOutcome: r.goal_outcome,
      startedAt: r.started_at,
      endedAt: r.ended_at,
    })),
  };
}

/** Manual "push weeks live now" (2026-08-06) — for a trainer who's
 * customized several weeks ahead through the calendar and wants that
 * content materialized today instead of waiting for the weekly cron to
 * reach each one naturally. No approval semantics as of 2026-08-07 --
 * every trainer-program materialization goes straight to 'active' now
 * (see materializeWeek's doc comment), so this is purely a "generate
 * now" convenience, not a distinct exception to anything. */
export async function bulkApproveClientWeeks(
  clientId: string,
  throughDate: string
): Promise<ActionResult<{ weeksGenerated: number; warnings: string[] }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await generateAndApproveWeeksThrough(clientId, throughDate, supabase);
  if (result.ok) {
    await logTrainerAction(user, "client_weeks_bulk_approved", clientId, {
      throughDate,
      weeksGenerated: result.data.weeksGenerated,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Calendar (2026-08-06) — month-by-month view of a client's assigned
// program, and per-date overrides/drag-move on top of it. All still
// scoped through requireActiveClient like every other trainer-on-client
// action here; the low-level read/write logic lives in
// domains/trainerprogram/overrides.ts and calendar-projection.ts.
// ---------------------------------------------------------------------------

export async function getClientMonthCalendar(
  clientId: string,
  monthStart: string,
  monthEnd: string
): Promise<ActionResult<ReturnType<typeof projectProgramRange>>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: assignment } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) return { ok: false, error: "No active program assigned." };

  const phases = await getHydratedPhasesForProgram(assignment.program_id, supabase);
  const overridesByDate = await getOverridesForRange(assignment.id, monthStart, monthEnd, supabase);

  const days = projectProgramRange({
    startsOn: assignment.starts_on,
    endDate: assignment.end_date,
    phases,
    rangeStart: monthStart,
    rangeEnd: monthEnd,
    overridesByDate,
  });

  return { ok: true, data: days };
}

/** For the workout page's empty-state -- when the *current* week
 * genuinely has nothing scheduled (a real, common case: any program with
 * fewer than 7 sessions/week will have some weeks where none of its
 * days fall between "today" and the end of the week, especially right
 * after assigning mid-week), "No workout plan yet" reads as broken even
 * though it's accurate to that one week. This looks further ahead (30
 * days) so the page can say what's actually coming instead of just
 * looking empty. Found 2026-08-06 when a trainer assigned a Mon/Wed-only
 * program on a Thursday -- the rest of that calendar week legitimately
 * has no sessions, but the UI gave no indication why or what to expect
 * next. */
export async function getNextScheduledSession(
  clientId: string
): Promise<ActionResult<{ date: string; sessionName: string | null } | null>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: assignment } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) return { ok: true, data: null };

  const phases = await getHydratedPhasesForProgram(assignment.program_id, supabase);
  const today = new Date().toISOString().slice(0, 10);
  const rangeEnd = addDays(today, 30);
  const overridesByDate = await getOverridesForRange(assignment.id, today, rangeEnd, supabase);

  const days = projectProgramRange({
    startsOn: assignment.starts_on,
    endDate: assignment.end_date,
    phases,
    rangeStart: today,
    rangeEnd,
    overridesByDate,
  });

  const next = days.find((d) => d.exercises.length > 0);
  return { ok: true, data: next ? { date: next.date, sessionName: next.sessionName } : null };
}

export async function setClientDateOverride(
  clientId: string,
  date: string,
  input: { isRestDay: boolean; exercises: OverrideExerciseInput[] }
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await setDateOverride(clientId, date, input, supabase);
  if (!result.ok) return result;
  await logTrainerAction(user, "client_date_override_set", clientId, { date, isRestDay: input.isRestDay });

  // Auto-sync (2026-08-07, replaces the old manual "Regenerate this
  // week" button): the override itself is already safely saved above
  // regardless of what happens here. If materialization fails, surface
  // it as this action's error so the trainer knows the client can't see
  // the edit yet -- the edit isn't lost, the next successful save or the
  // weekly cron will pick it up.
  return materializeWeekContaining(clientId, date, supabase);
}

export async function clearClientDateOverride(clientId: string, date: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await clearDateOverride(clientId, date, supabase);
  if (!result.ok) return result;
  await logTrainerAction(user, "client_date_override_cleared", clientId, { date });
  return materializeWeekContaining(clientId, date, supabase);
}

/** Drag-and-drop "move" semantics: fromDate's effective content (whether
 * already an override or just the recurring template) becomes toDate's
 * new override, and fromDate itself becomes a rest-day override — a
 * move, not a copy, matching normal calendar drag UX. Both dates go
 * through the same past/not-started validation as any other override
 * write (setDateOverride), so this refuses to touch history either.
 *
 * Two sequential writes, no real database transaction available at this
 * layer — if the second (fromDate) write fails after the first (toDate)
 * succeeded, the naive version would leave the session duplicated on
 * both dates rather than moved. Snapshots toDate's pre-move state first
 * and restores it (found in code review, 2026-08-06) if the fromDate
 * write fails, so a failure always leaves the calendar exactly as it was
 * before the drag, never duplicated. */
export async function moveClientSessionToDate(
  clientId: string,
  fromDate: string,
  toDate: string
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }
  if (fromDate === toDate) return { ok: true, data: undefined };

  const { data: assignment } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) return { ok: false, error: "No active program assigned." };

  const phases = await getHydratedPhasesForProgram(assignment.program_id, supabase);
  const overridesByDate = await getOverridesForRange(assignment.id, fromDate, toDate, supabase);

  const [fromProjection] = projectProgramRange({
    startsOn: assignment.starts_on,
    endDate: assignment.end_date,
    phases,
    rangeStart: fromDate,
    rangeEnd: fromDate,
    overridesByDate,
  });
  if (!fromProjection) return { ok: false, error: "Couldn't read that date." };

  // Snapshot toDate's pre-move state so a failed second write can be
  // rolled back to exactly this, not just cleared to template.
  const [toProjectionBefore] = projectProgramRange({
    startsOn: assignment.starts_on,
    endDate: assignment.end_date,
    phases,
    rangeStart: toDate,
    rangeEnd: toDate,
    overridesByDate,
  });

  const toResult = await setDateOverride(
    clientId,
    toDate,
    { isRestDay: fromProjection.exercises.length === 0, exercises: fromProjection.exercises },
    supabase
  );
  if (!toResult.ok) return toResult;

  const fromResult = await setDateOverride(clientId, fromDate, { isRestDay: true, exercises: [] }, supabase);
  if (!fromResult.ok) {
    if (toProjectionBefore?.source === "override") {
      await setDateOverride(
        clientId,
        toDate,
        { isRestDay: toProjectionBefore.exercises.length === 0, exercises: toProjectionBefore.exercises },
        supabase
      );
    } else {
      await clearDateOverride(clientId, toDate, supabase);
    }
    return fromResult;
  }

  await logTrainerAction(user, "client_session_moved", clientId, { fromDate, toDate });

  // Auto-sync both ends of the move -- a drag can cross a week boundary,
  // so this isn't always the same week twice. Dedup by week_start so a
  // same-week drag (the common case) only materializes once.
  const fromWeek = sundayOfWeekContaining(fromDate);
  const toWeek = sundayOfWeekContaining(toDate);
  const fromSync = await materializeWeekContaining(clientId, fromDate, supabase);
  if (!fromSync.ok) return fromSync;
  if (toWeek !== fromWeek) {
    const toSync = await materializeWeekContaining(clientId, toDate, supabase);
    if (!toSync.ok) return toSync;
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Trainer-authored nutrition programs (2026-08-07) -- assigning one of
// the trainer's own domains/trainermealprogram programs to a client, and
// reviewing/tailoring per-client portion sizes. Mirrors the workout
// program-assignment section above closely; see that section's own
// comments for conventions reused here without re-explaining them.
//
// Materialization into meal_plans/meal_plan_items (2026-08-07) lives in
// domains/trainermealprogram/materialize.ts, not here -- mirrors
// domains/trainerprogram/materialize.ts being its own module rather than
// folded into this file. resolveMealProgramPhase itself moved to
// domains/trainermealprogram/phase-resolution.ts so materialize.ts could
// use it without a circular import back into this file.
// ---------------------------------------------------------------------------

/** end_date and goalOutcome are both required (same reasoning as
 * assignProgramToClient above) -- enforced here, not the database. The
 * linked goal goes on the client's 'nutrition' domain this time, not
 * 'exercise' (both already trainer-writable, migrations 0077/0079). */
export async function assignMealProgramToClient(
  clientId: string,
  programId: string,
  startsOn: string,
  endDate: string,
  goalOutcome: string
): Promise<ActionResult<{ warnings: string[] }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const resolvedStartsOn = startsOn || new Date().toISOString().slice(0, 10);
  const trimmedGoal = goalOutcome.trim();
  if (!trimmedGoal) return { ok: false, error: "State a tangible goal for this program." };
  if (!endDate) return { ok: false, error: "Set an end date for this program." };
  if (endDate <= resolvedStartsOn) return { ok: false, error: "End date must be after the start date." };

  const { data: programRow } = await supabase
    .from("trainer_meal_programs")
    .select("id, trainer_id, status")
    .eq("id", programId)
    .maybeSingle();
  if (!programRow || programRow.trainer_id !== user.id) {
    return { ok: false, error: "Program not found." };
  }
  if (programRow.status !== "published") {
    return { ok: false, error: "Publish this program before assigning it." };
  }

  const { data: phaseRows } = await supabase
    .from("trainer_meal_program_phases")
    .select("id")
    .eq("program_id", programId)
    .limit(1);
  if (!phaseRows || phaseRows.length === 0) {
    return { ok: false, error: "Add at least one phase to this program before assigning it." };
  }

  // Find or create the client's "nutrition" domain to hang the goal off
  // of -- same pattern as assignProgramToClient's own "exercise" domain
  // lookup, just the sibling fitness-relevant key.
  const { data: existingDomain } = await supabase
    .from("domains")
    .select("id")
    .eq("user_id", clientId)
    .eq("key", "nutrition")
    .maybeSingle();

  let domainId = existingDomain?.id;
  if (!domainId) {
    const { data: newDomain, error: domainError } = await supabase
      .from("domains")
      .insert({ user_id: clientId, key: "nutrition", label: "Nutrition" })
      .select("id")
      .single();
    if (domainError || !newDomain) {
      return { ok: false, error: `Couldn't set up the client's nutrition goals: ${domainError?.message}` };
    }
    domainId = newDomain.id;
  }

  const { data: goalRow, error: goalError } = await supabase
    .from("goals")
    .insert({ user_id: clientId, domain_id: domainId, outcome: trimmedGoal, target_date: endDate, status: "active" })
    .select("id")
    .single();
  if (goalError || !goalRow) {
    return { ok: false, error: `Couldn't create the linked goal: ${goalError?.message}` };
  }

  // End any existing active meal-program assignment for this client
  // first -- the partial unique index (migration 0083) would otherwise
  // reject the new insert. Recorded by id (with program_id, needed below
  // to archive its stale materialized plans), same failed-insert-
  // reactivates safety net as assignProgramToClient above.
  const { data: previousActive } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id, program_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (previousActive) {
    const { error: endError } = await supabase
      .from("trainer_meal_program_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", previousActive.id);
    if (endError) return { ok: false, error: endError.message };
  }

  const { error: insertError } = await supabase.from("trainer_meal_program_assignments").insert({
    program_id: programId,
    trainer_id: user.id,
    client_id: clientId,
    starts_on: resolvedStartsOn,
    end_date: endDate,
    goal_outcome: trimmedGoal,
    linked_goal_id: goalRow.id,
  });
  if (insertError) {
    if (previousActive) {
      await supabase
        .from("trainer_meal_program_assignments")
        .update({ status: "active", ended_at: null })
        .eq("id", previousActive.id);
    }
    await supabase.from("goals").update({ status: "abandoned" }).eq("id", goalRow.id);
    return { ok: false, error: insertError.message };
  }

  // Clean up the OLD program's leftovers now that the switch actually
  // committed -- same reasoning as archiveStaleTrainerProgramPlans's own
  // doc comment: this can't wait on materializeCurrentMealWeek below to
  // overwrite it naturally, since it won't if the new program hasn't
  // started yet.
  if (previousActive) {
    await archiveStaleTrainerMealPlans(clientId, previousActive.program_id, supabase);
  }

  // A no-op (with an explanatory warning, not an error) if startsOn is in
  // the future -- materializeCurrentMealWeek itself checks that. Its
  // warnings are surfaced here rather than discarded, same lesson code
  // review found on the workout side: a future-dated assignment
  // previously reporting bare success with no indication nothing was
  // actually generated yet.
  const materialized = await materializeCurrentMealWeek(clientId, supabase);
  if (!materialized.ok) return materialized;

  await logTrainerAction(user, "client_meal_program_assigned", clientId, { programId, startsOn, endDate });
  return { ok: true, data: { warnings: materialized.data.warnings } };
}

export async function unassignMealProgram(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: activeAssignment } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id, program_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  const { error } = await supabase
    .from("trainer_meal_program_assignments")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  if (activeAssignment) {
    await archiveStaleTrainerMealPlans(clientId, activeAssignment.program_id, supabase);
  }

  await logTrainerAction(user, "client_meal_program_unassigned", clientId, {});
  return { ok: true, data: undefined };
}

async function loadMealAssignmentView(
  clientId: string,
  supabase: SupabaseClient<Database>
): Promise<TrainerMealProgramAssignment | null> {
  const { data: row } = await supabase
    .from("trainer_meal_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!row) return null;

  const [{ data: programRow }, { data: phaseRows }] = await Promise.all([
    supabase.from("trainer_meal_programs").select("name").eq("id", row.program_id).maybeSingle(),
    supabase
      .from("trainer_meal_program_phases")
      .select("id, name, length_weeks")
      .eq("program_id", row.program_id)
      .order("phase_order", { ascending: true }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const resolved = resolveMealProgramPhase(
    row.starts_on,
    (phaseRows ?? []).map((p) => ({ id: p.id, name: p.name, lengthWeeks: p.length_weeks })),
    today
  );

  return {
    id: row.id,
    programId: row.program_id,
    programName: programRow?.name ?? "Untitled program",
    trainerId: row.trainer_id,
    clientId: row.client_id,
    status: row.status as TrainerMealProgramAssignment["status"],
    startsOn: row.starts_on,
    endDate: row.end_date,
    goalOutcome: row.goal_outcome,
    currentPhaseId: resolved?.phaseId ?? null,
    currentPhaseName: resolved?.phaseName ?? null,
    currentWeekInPhase: resolved?.weekInPhase ?? null,
    nutritionOverride: (row.nutrition_override as unknown as NutritionOverride | null) ?? null,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export async function getClientMealProgramAssignment(clientId: string): Promise<TrainerMealProgramAssignment | null> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) return null;
  return loadMealAssignmentView(clientId, supabase);
}

/** Mirrors listClientAssignmentHistory above. */
export async function listClientMealAssignmentHistory(clientId: string): Promise<ActionResult<PastMealAssignment[]>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: rows, error } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id, program_id, starts_on, end_date, goal_outcome, status, started_at, ended_at")
    .eq("client_id", clientId)
    .eq("status", "ended")
    .order("started_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) return { ok: true, data: [] };

  const programIds = Array.from(new Set(rows.map((r) => r.program_id)));
  const { data: programRows } = await supabase.from("trainer_meal_programs").select("id, name").in("id", programIds);
  const nameById = new Map((programRows ?? []).map((p) => [p.id, p.name]));

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      programId: r.program_id,
      programName: nameById.get(r.program_id) ?? "Untitled program",
      startsOn: r.starts_on,
      endDate: r.end_date,
      goalOutcome: r.goal_outcome,
      startedAt: r.started_at,
      endedAt: r.ended_at,
    })),
  };
}

/** Computes (does not persist) daily calorie/protein targets scoped to
 * the client's currently active assignment's own starts_on/end_date, as
 * opposed to their long-range generated_parameters calorie_target -- see
 * migration 0084's comment for the full "trainer's engagement window
 * often doesn't match the client's own goal timeline" reasoning. Reuses
 * the same deterministic calculateNutritionParameters function and the
 * same profile inputs generateNutritionParameters draws on for the
 * client's own target, just with different date scoping, so the trainer
 * gets the same rationale/assumptions/safety-bounds transparency CLAUDE.md
 * requires anywhere a value gets derived on someone's behalf -- even
 * though this number never touches generated_parameters itself. */
export async function previewEngagementNutritionTargets(
  clientId: string
): Promise<ActionResult<{ calorieParameter: GeneratedParameter; proteinParameter: GeneratedParameter }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: assignment } = await supabase
    .from("trainer_meal_program_assignments")
    .select("starts_on, end_date")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) return { ok: false, error: "No active nutrition program assigned." };
  if (!assignment.end_date) return { ok: false, error: "This assignment has no end date to scope to." };

  const baseInputs = await getNutritionCalculationBaseInputs(clientId);
  const { parameters, missingInputs } = calculateNutritionParameters({
    ...baseInputs,
    today: assignment.starts_on,
    targetDate: assignment.end_date,
  });

  const calorieParameter = parameters.find((p) => p.id === "calorie_target");
  const proteinParameter = parameters.find((p) => p.id === "protein_target_g");
  if (!calorieParameter || !proteinParameter) {
    return {
      ok: false,
      error: `Add ${missingInputs.join(" and ")} on the client's own onboarding before Areta can calculate engagement targets.`,
    };
  }

  return { ok: true, data: { calorieParameter, proteinParameter } };
}

/** Persists an engagement-scoped nutrition target on the active
 * assignment. calorieTarget/proteinTarget are whatever the trainer wants
 * in effect -- normally the preview's computed values verbatim, but the
 * trainer may edit them first (same suggest-then-edit pattern as
 * portions). Recomputes the full breakdown server-side rather than
 * trusting client-supplied rationale, so the stored record always traces
 * back to a real calculation even if the final number was hand-adjusted. */
export async function saveEngagementNutritionTargets(
  clientId: string,
  calorieTarget: number,
  proteinTarget: number
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }
  if (!(calorieTarget > 0) || !(proteinTarget > 0)) {
    return { ok: false, error: "Targets must be positive numbers." };
  }

  const { data: assignment } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id, starts_on, end_date")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) return { ok: false, error: "No active nutrition program assigned." };
  if (!assignment.end_date) return { ok: false, error: "This assignment has no end date to scope to." };

  const baseInputs = await getNutritionCalculationBaseInputs(clientId);
  const { parameters } = calculateNutritionParameters({
    ...baseInputs,
    today: assignment.starts_on,
    targetDate: assignment.end_date,
  });
  const computedCalorieParameter = parameters.find((p) => p.id === "calorie_target");
  const computedProteinParameter = parameters.find((p) => p.id === "protein_target_g");
  if (!computedCalorieParameter || !computedProteinParameter) {
    return { ok: false, error: "Couldn't recompute this engagement's targets — try recalculating again." };
  }

  const nutritionOverride: NutritionOverride = {
    calorieTarget,
    proteinTarget,
    computedCalorieParameter,
    computedProteinParameter,
    computedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("trainer_meal_program_assignments")
    .update({
      nutrition_override: nutritionOverride,
      nutrition_override_updated_at: nutritionOverride.computedAt,
    })
    .eq("id", assignment.id);
  if (error) return { ok: false, error: error.message };

  // Re-sync the client's actual meal plan -- getMealPortionRows (and so
  // materializeCurrentMealWeek) reads this override's calorieTarget to
  // recompute recommended servings, so a saved engagement target that
  // never reaches meal_plan_items would be misleading: the trainer would
  // see one number here and the client a stale plan built off the old one.
  const materialized = await materializeCurrentMealWeek(clientId, supabase);
  if (!materialized.ok) return materialized;

  await logTrainerAction(user, "client_engagement_nutrition_targets_saved", clientId, {
    calorieTarget,
    proteinTarget,
  });
  return { ok: true, data: undefined };
}

/** Reverts to the client's own approved calorie_target (today's default
 * behavior) by clearing the engagement override. */
export async function clearEngagementNutritionOverride(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { error } = await supabase
    .from("trainer_meal_program_assignments")
    .update({ nutrition_override: null, nutrition_override_updated_at: null })
    .eq("client_id", clientId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  const materialized = await materializeCurrentMealWeek(clientId, supabase);
  if (!materialized.ok) return materialized;

  await logTrainerAction(user, "client_engagement_nutrition_targets_cleared", clientId, {});
  return { ok: true, data: undefined };
}

/** Recommendations plus whatever the trainer has already saved, for
 * every meal in one phase -- the portion-review screen's data source.
 * The recommendation itself is never stored (migration 0083's own
 * comment) -- recomputed live every call, so it can't go stale the way a
 * stored-at-assignment-time number would if the underlying target
 * changes later. calorieTarget/calorieTargetSource are returned alongside
 * the rows (not just baked into the math) so the UI can show an honest,
 * source-specific caveat: an engagement override (this assignment's own
 * scoped calculation, migration 0084) takes priority over the client's
 * own long-range approved calorie_target, which takes priority over a
 * generic 2000 placeholder when neither exists yet -- the recommendation
 * still has to produce *something* in that last case rather than
 * blocking the whole screen on a target nobody's computed yet. */
export async function getMealPortionRecommendations(
  clientId: string,
  phaseId: string
): Promise<
  ActionResult<{
    calorieTarget: number | null;
    calorieTargetSource: "engagement" | "client_approved" | "fallback";
    rows: MealPortionRow[];
  }>
> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const [{ data: assignment }, approvedCalorieTarget] = await Promise.all([
    supabase
      .from("trainer_meal_program_assignments")
      .select("id, nutrition_override")
      .eq("client_id", clientId)
      .eq("status", "active")
      .maybeSingle(),
    getApprovedParameterValue(clientId, "nutrition", "calorie_target"),
  ]);

  const engagementOverride = (assignment?.nutrition_override as unknown as NutritionOverride | null) ?? null;
  const calorieTarget = engagementOverride?.calorieTarget ?? approvedCalorieTarget;
  const calorieTargetSource: "engagement" | "client_approved" | "fallback" = engagementOverride
    ? "engagement"
    : approvedCalorieTarget
      ? "client_approved"
      : "fallback";

  const rows = await getMealPortionRows(phaseId, assignment?.id ?? null, calorieTarget, supabase);
  return { ok: true, data: { calorieTarget, calorieTargetSource, rows } };
}

/** Bulk upsert -- the whole portions form saves in one action rather
 * than one request per row. Requires an active assignment (portions are
 * always scoped to one, per migration 0083's own FK). */
export async function saveMealPortions(
  clientId: string,
  portions: { programMealId: string; servings: number }[]
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const { data: assignment } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!assignment) return { ok: false, error: "No active nutrition program assigned." };

  if (portions.length === 0) return { ok: true, data: undefined };

  const { error } = await supabase.from("trainer_meal_program_portions").upsert(
    portions.map((p) => ({
      assignment_id: assignment.id,
      program_meal_id: p.programMealId,
      servings: p.servings,
    })),
    { onConflict: "assignment_id,program_meal_id" }
  );
  if (error) return { ok: false, error: error.message };

  // Saved portions only matter if they actually reach the client's real
  // plan -- re-materialize so meal_plan_items.servings picks up whatever
  // was just saved instead of whatever recommendServings would still
  // compute on its own.
  const materialized = await materializeCurrentMealWeek(clientId, supabase);
  if (!materialized.ok) return materialized;

  await logTrainerAction(user, "client_meal_portions_saved", clientId, { count: portions.length });
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Client side — redemption and ending a relationship are inherently
// cross-user writes (see migration 0066's comment on trainer_clients
// having no insert/update RLS policy), so both go through the
// service-role client with their own explicit requireUser() check rather
// than relying on a same-user RLS policy that can't express this safely.
// ---------------------------------------------------------------------------

export async function getMyTrainerRelationship(): Promise<MyTrainerInfo | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: relationship } = await supabase
    .from("trainer_clients")
    .select("id, trainer_id, started_at")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) return null;

  const nameById = await getVisibleNames(supabase, [relationship.trainer_id]);

  return {
    relationshipId: relationship.id,
    trainerId: relationship.trainer_id,
    trainerName: nameById.get(relationship.trainer_id) ?? null,
    startedAt: relationship.started_at,
  };
}

export async function redeemTrainerInviteCode(rawCode: string): Promise<ActionResult> {
  const user = await requireUser();
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter an invite code." };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("trainer_clients")
    .select("id")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "You already have an active trainer — end that relationship first." };
  }

  const { data: invite, error: inviteError } = await admin
    .from("trainer_invite_codes")
    .select("id, trainer_id, expires_at, used_at, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (inviteError || !invite) return { ok: false, error: "Invalid invite code." };
  if (invite.used_at) return { ok: false, error: "This code has already been used." };
  if (invite.revoked_at) return { ok: false, error: "This code has been revoked." };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { ok: false, error: "This code has expired." };
  }
  if (invite.trainer_id === user.id) {
    return { ok: false, error: "You can't redeem your own invite code." };
  }

  const { data: trainerProfile } = await admin
    .from("profiles")
    .select("is_trainer")
    .eq("id", invite.trainer_id)
    .maybeSingle();
  if (!trainerProfile?.is_trainer) {
    return { ok: false, error: "This trainer's access has been revoked." };
  }

  // Atomic claim on the code itself (WHERE used_at IS NULL) before the
  // trainer_clients insert, not after — closes a race where two
  // concurrent redemptions of the same leaked/shared code could both
  // pass the used_at check above and both link, since neither had
  // claimed the code yet at check time.
  const { data: claimed } = await admin
    .from("trainer_invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, error: "This code has already been used." };
  }

  const { error: insertError } = await admin.from("trainer_clients").insert({
    trainer_id: invite.trainer_id,
    client_id: user.id,
  });
  if (insertError) {
    // Most likely the partial unique index (trainer_clients_one_active_client)
    // rejecting a race with another redemption for this same client.
    // Release the claim above so the code isn't burned for nothing.
    await admin.from("trainer_invite_codes").update({ used_by: null, used_at: null }).eq("id", invite.id);
    return { ok: false, error: "Could not link to this trainer — you may already have an active trainer." };
  }

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_invite_redeemed",
    targetType: "trainer_client",
    targetId: invite.trainer_id,
    detail: { clientId: user.id },
  });

  return { ok: true, data: undefined };
}

/** Callable by either side of the relationship — a client dropping their
 * trainer, or a trainer ending their coaching of a client. */
/** Client-side "drop my trainer" — always targets the relationship where
 * *I'm* the client, never ambiguous even for an account that's also a
 * trainer with clients of its own (fixed 2026-08-22: the original
 * `.or(trainer_id.eq...,client_id.eq...)` could match more than one row
 * for a dual-role account, and .maybeSingle() erroring on >1 row was
 * silently swallowed into a false "no active relationship found"). See
 * removeClient below for the trainer-initiated equivalent. */
export async function endTrainerRelationship(): Promise<ActionResult> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: relationship } = await admin
    .from("trainer_clients")
    .select("id, trainer_id, client_id")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) return { ok: false, error: "No active trainer relationship found." };

  const { error } = await admin
    .from("trainer_clients")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", relationship.id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_relationship_ended",
    targetType: "trainer_client",
    targetId: relationship.id,
    detail: { trainerId: relationship.trainer_id, clientId: relationship.client_id, endedBy: user.id },
  });

  return { ok: true, data: undefined };
}

/** Trainer-side equivalent of endTrainerRelationship — a trainer
 * dropping one specific client, unambiguous by construction since it
 * takes the target clientId rather than inferring "the" relationship. */
export async function removeClient(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const admin = createAdminClient();

  const { data: relationship } = await admin
    .from("trainer_clients")
    .select("id")
    .eq("trainer_id", user.id)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) return { ok: false, error: "This is not your client." };

  const { error } = await admin
    .from("trainer_clients")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", relationship.id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_relationship_ended",
    targetType: "trainer_client",
    targetId: relationship.id,
    detail: { trainerId: user.id, clientId, endedBy: user.id },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Marketplace/discovery (migration 0071) — deferred when the trainer role
// was first scoped, built on explicit confirmation. Client-initiated
// counterpart to the trainer-issued invite code: a client browses
// discoverable trainers and sends a request instead of waiting for a code.
// ---------------------------------------------------------------------------

function toTrainerProfile(row: {
  trainer_id: string;
  bio: string | null;
  years_experience: number | null;
  specialties: string[];
  location_city: string | null;
  location_region: string | null;
  is_discoverable: boolean;
}): TrainerProfile {
  return {
    trainerId: row.trainer_id,
    bio: row.bio,
    yearsExperience: row.years_experience,
    specialties: row.specialties,
    locationCity: row.location_city,
    locationRegion: row.location_region,
    isDiscoverable: row.is_discoverable,
  };
}

export async function getMyTrainerProfile(): Promise<TrainerProfile | null> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  const { data } = await supabase.from("trainer_profiles").select("*").eq("trainer_id", user.id).maybeSingle();
  return data ? toTrainerProfile(data) : null;
}

export async function upsertMyTrainerProfile(input: {
  bio: string | null;
  yearsExperience: number | null;
  specialties: string[];
  locationCity: string | null;
  locationRegion: string | null;
  isDiscoverable: boolean;
}): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  const { error } = await supabase.from("trainer_profiles").upsert({
    trainer_id: user.id,
    bio: input.bio,
    years_experience: input.yearsExperience,
    specialties: input.specialties,
    location_city: input.locationCity,
    location_region: input.locationRegion,
    is_discoverable: input.isDiscoverable,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

/** Authenticated browsing only — see migration 0071's comment on why
 * this doesn't open to unauthenticated visitors in this pass. */
export async function listDiscoverableTrainers(filters?: {
  city?: string;
  specialty?: string;
}): Promise<DiscoverableTrainer[]> {
  await requireUser();
  const supabase = await createClient();

  let query = supabase.from("trainer_profiles").select("*").eq("is_discoverable", true);
  if (filters?.city) query = query.ilike("location_city", `%${filters.city}%`);
  if (filters?.specialty) query = query.contains("specialties", [filters.specialty]);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load trainers: ${error.message}`);
  if (!data || data.length === 0) return [];

  const trainerIds = data.map((row) => row.trainer_id);
  const nameById = await getVisibleNames(supabase, trainerIds);

  return data.map((row) => ({ ...toTrainerProfile(row), fullName: nameById.get(row.trainer_id) ?? null }));
}

/** Null both when no such trainer exists and when they exist but aren't
 * discoverable (RLS returns nothing either way to a non-owner caller) —
 * the page renders a 404 for both, same as any other "not found". */
export async function getTrainerPublicProfile(trainerId: string): Promise<DiscoverableTrainer | null> {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase.from("trainer_profiles").select("*").eq("trainer_id", trainerId).maybeSingle();
  if (!data) return null;

  const nameById = await getVisibleNames(supabase, [trainerId]);
  return { ...toTrainerProfile(data), fullName: nameById.get(trainerId) ?? null };
}

export async function requestTrainer(trainerId: string, message: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  if (trainerId === user.id) {
    return { ok: false, error: "You can't request yourself as a trainer." };
  }

  // Checked against trainer_profiles.is_discoverable rather than
  // profiles.is_trainer directly — a client's own session can no
  // longer read another user's is_trainer column at all (migration
  // 0072 dropped the only cross-user profiles SELECT policies), and
  // this check is arguably the more correct one anyway: it also
  // naturally rejects a trainer who's since unlisted themselves or
  // been revoked (setUserTrainerStatus unsets is_discoverable on
  // revoke), not just a never-was-a-trainer id.
  const { data: trainerProfile } = await supabase
    .from("trainer_profiles")
    .select("trainer_id")
    .eq("trainer_id", trainerId)
    .eq("is_discoverable", true)
    .maybeSingle();
  if (!trainerProfile) {
    return { ok: false, error: "This trainer isn't available to request right now." };
  }

  const { data: existingRelationship } = await supabase
    .from("trainer_clients")
    .select("id")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (existingRelationship) {
    return { ok: false, error: "You already have an active trainer — end that relationship first." };
  }

  const { data: existingRequest } = await supabase
    .from("trainer_requests")
    .select("id")
    .eq("client_id", user.id)
    .eq("trainer_id", trainerId)
    .eq("status", "pending")
    .maybeSingle();
  if (existingRequest) {
    return { ok: false, error: "You already have a pending request to this trainer." };
  }

  const { error } = await supabase.from("trainer_requests").insert({
    client_id: user.id,
    trainer_id: trainerId,
    message: message || null,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

export async function listMyTrainerRequests(): Promise<MyTrainerRequest[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trainer_requests")
    .select("id, trainer_id, message, status, created_at")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load requests: ${error.message}`);
  if (!data || data.length === 0) return [];

  const trainerIds = [...new Set(data.map((r) => r.trainer_id))];
  const nameById = await getVisibleNames(supabase, trainerIds);

  return data.map((r) => ({
    id: r.id,
    trainerId: r.trainer_id,
    trainerName: nameById.get(r.trainer_id) ?? null,
    message: r.message,
    status: r.status as MyTrainerRequest["status"],
    createdAt: r.created_at,
  }));
}

export async function cancelTrainerRequest(requestId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("trainer_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("client_id", user.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

export async function listIncomingTrainerRequests(): Promise<IncomingTrainerRequest[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trainer_requests")
    .select("id, client_id, message, status, created_at")
    .eq("trainer_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load requests: ${error.message}`);
  if (!data || data.length === 0) return [];

  const clientIds = [...new Set(data.map((r) => r.client_id))];
  const nameById = await getVisibleNames(supabase, clientIds);

  return data.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: nameById.get(r.client_id) ?? null,
    message: r.message,
    status: r.status as IncomingTrainerRequest["status"],
    createdAt: r.created_at,
  }));
}

/** Accepting has the same cross-user side effect as redeeming an invite
 * code (creates a trainer_clients row), so this goes through the
 * service-role client with its own explicit checks, same reasoning as
 * redeemTrainerInviteCode — not a raw RLS update. */
export async function respondToTrainerRequest(requestId: string, accept: boolean): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("trainer_requests")
    .select("id, client_id, trainer_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.trainer_id !== user.id) {
    return { ok: false, error: "Request not found." };
  }
  if (request.status !== "pending") {
    return { ok: false, error: "This request has already been responded to." };
  }

  if (!accept) {
    const { error: declineError } = await admin
      .from("trainer_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    if (declineError) return { ok: false, error: declineError.message };

    await logAdminAction({
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "trainer_request_declined",
      targetType: "trainer_client",
      targetId: request.client_id,
      detail: { trainerId: user.id, clientId: request.client_id, requestId },
    });

    return { ok: true, data: undefined };
  }

  const { data: existing } = await admin
    .from("trainer_clients")
    .select("id")
    .eq("client_id", request.client_id)
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "This client already has an active trainer." };
  }

  const { error: insertError } = await admin.from("trainer_clients").insert({
    trainer_id: user.id,
    client_id: request.client_id,
  });
  if (insertError) {
    return { ok: false, error: "Could not accept — this client may already have an active trainer." };
  }

  await admin
    .from("trainer_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId);

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_request_accepted",
    targetType: "trainer_client",
    targetId: request.client_id,
    detail: { trainerId: user.id, clientId: request.client_id, requestId },
  });

  return { ok: true, data: undefined };
}
