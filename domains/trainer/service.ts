"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { requireTrainer } from "@/platform/auth/trainer";
import { requireUser } from "@/platform/auth/session";
import { logAdminAction } from "@/platform/audit/log";
import type { ActionResult } from "@/platform/auth/actions";
import type {
  TrainerClientSummary,
  InviteCode,
  ClientHistorySummary,
  ClientGoal,
  MyTrainerInfo,
} from "@/domains/trainer/types";

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

  const { data: relationship } = await supabase
    .from("trainer_clients")
    .select("id")
    .eq("trainer_id", user.id)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) return { ok: false, error: "This is not your client." };

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

  const { data: relationship } = await supabase
    .from("trainer_clients")
    .select("id")
    .eq("trainer_id", user.id)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) return { ok: false, error: "This is not your client." };

  const { error } = await supabase
    .from("goals")
    .update({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    })
    .eq("id", goalId)
    .eq("user_id", clientId);
  if (error) return { ok: false, error: error.message };

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

  const { error: insertError } = await admin.from("trainer_clients").insert({
    trainer_id: invite.trainer_id,
    client_id: user.id,
  });
  if (insertError) {
    // Most likely the partial unique index (trainer_clients_one_active_client)
    // rejecting a race with another redemption for this same client.
    return { ok: false, error: "Could not link to this trainer — you may already have an active trainer." };
  }

  await admin
    .from("trainer_invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", invite.id);

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
