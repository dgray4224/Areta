"use server";

import { randomBytes } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { requireTrainer } from "@/platform/auth/trainer";
import { requireUser } from "@/platform/auth/session";
import { logAdminAction } from "@/platform/audit/log";
import { getApprovedParameterValue, getGeneratedParameters, approveAllGeneratedParameters, type StoredParameter } from "@/domains/parameters/service";
import { generateAndSaveMealPlan, getActiveMealPlan, type MealPlanView } from "@/domains/mealplan/service";
import { approveMealPlanAndGenerateDownstream } from "@/domains/mealplan/approve-flow";
import {
  generateAndSaveWorkoutPlan,
  getActiveWorkoutPlan,
  approveWorkoutPlan,
  customizeWorkoutPlanItemExercise,
  addWorkoutPlanItemExercise,
  type WorkoutPlanView,
  type WorkoutPlanItemView,
  type CustomizeExerciseInput,
} from "@/domains/workoutplan/service";
import type { ActionResult } from "@/platform/auth/actions";
import type { Database } from "@/platform/db/types";
import type {
  TrainerClientSummary,
  InviteCode,
  ClientHistorySummary,
  ClientGoal,
  MyTrainerInfo,
} from "@/domains/trainer/types";

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
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", clientIds);
  const nameById = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

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
    const { error } = await supabase.from("trainer_invite_codes").insert({
      trainer_id: user.id,
      code,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (!error) return { ok: true, data: { code } };
    if (!error.message.includes("duplicate")) return { ok: false, error: error.message };
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
  const nameById = new Map<string, string | null>();
  if (usedByIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", usedByIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name);
  }

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

  const [weightRes, sleepRes, nutritionRes, recoveryRes, goalsRes] = await Promise.all([
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
  ]);

  const summary: ClientHistorySummary = {
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
    getActiveMealPlan(clientId, supabase),
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
 * since that needs onboarding data only the client has entered. */
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

/** Requires calorie/protein targets already approved (by the client
 * themselves, or by the trainer via approveClientNutritionParameters
 * above) — same precondition generateAndSaveMealPlan enforces for
 * anyone calling it. */
export async function generateClientMealPlan(clientId: string): Promise<ActionResult<{ warnings: string[] }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await generateAndSaveMealPlan(clientId);
  if (result.ok) await logTrainerAction(user, "client_meal_plan_generated", clientId, {});
  return result;
}

/** Cascades into the grocery list and Sunday prep plan too, same as when
 * the client approves their own plan (approveMealPlanAndGenerateDownstream). */
export async function approveClientMealPlan(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await approveMealPlanAndGenerateDownstream(clientId);
  if (result.ok) await logTrainerAction(user, "client_meal_plan_approved", clientId, {});
  return result;
}

export async function getClientWorkoutOverview(
  clientId: string
): Promise<ActionResult<{ workoutPlan: WorkoutPlanView | null }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const workoutPlan = await getActiveWorkoutPlan(clientId, supabase);
  return { ok: true, data: { workoutPlan } };
}

export async function generateClientWorkoutPlan(clientId: string): Promise<ActionResult<{ warnings: string[] }>> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await generateAndSaveWorkoutPlan(clientId);
  if (result.ok) await logTrainerAction(user, "client_workout_plan_generated", clientId, {});
  return result;
}

export async function approveClientWorkoutPlan(clientId: string): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (!(await requireActiveClient(user.id, clientId, supabase))) {
    return { ok: false, error: "This is not your client." };
  }

  const result = await approveWorkoutPlan(clientId);
  if (result.ok) await logTrainerAction(user, "client_workout_plan_approved", clientId, {});
  return result;
}

/** Free-form replace — see CustomizeExerciseInput's own doc comment in
 * domains/workoutplan/service.ts. Curated "alternates" swap
 * (swapWorkoutPlanItemExercise, mobile-only today via app/api/exercise)
 * isn't wired up here — that needs the same slot-options/equipment
 * filtering app/api/exercise/route.ts's GET handler does, which is a
 * bigger lift than a free-pick replace; deliberately out of scope for
 * this pass. */
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
  if (result.ok) {
    await logTrainerAction(user, "client_workout_item_customized", clientId, { itemId, ...input });
  }
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
  if (result.ok) {
    await logTrainerAction(user, "client_workout_item_added", clientId, { dayOfWeek, ...input });
  }
  return result;
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

  const { data: trainerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", relationship.trainer_id)
    .maybeSingle();

  return {
    relationshipId: relationship.id,
    trainerId: relationship.trainer_id,
    trainerName: trainerProfile?.full_name ?? null,
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
export async function endTrainerRelationship(): Promise<ActionResult> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: relationship } = await admin
    .from("trainer_clients")
    .select("id, trainer_id, client_id")
    .or(`trainer_id.eq.${user.id},client_id.eq.${user.id}`)
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
