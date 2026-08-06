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
  TrainerProfile,
  DiscoverableTrainer,
  MyTrainerRequest,
  IncomingTrainerRequest,
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
/** customizeWorkoutPlanItemExercise/addWorkoutPlanItemExercise (unlike
 * this file's own generate/approve wrappers) write straight to an
 * existing plan with no approval gate of their own — fine for a client
 * tweaking their own already-approved plan, but a trainer silently
 * rewriting a client's *already-active* plan with no new approval step
 * breaks CLAUDE.md rule 10 ("require approval before changing active
 * plans"). Found in the 2026-08-06 code-review pass. Demoting the
 * client's active plan back to draft after a trainer edit means the
 * change has to be approved (by the trainer or the client) before it's
 * live again, same as a fresh generate — not a silent live rewrite. */
async function demoteActivePlanToDraft(supabase: SupabaseClient<Database>, clientId: string): Promise<void> {
  await supabase.from("workout_plans").update({ status: "draft" }).eq("user_id", clientId).eq("status", "active");
}

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
    await demoteActivePlanToDraft(supabase, clientId);
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
    await demoteActivePlanToDraft(supabase, clientId);
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
    await admin
      .from("trainer_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", requestId);
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
