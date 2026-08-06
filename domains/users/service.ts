"use server";

import { createAdminClient } from "@/platform/supabase/admin";
import { requireAdminOwner } from "@/platform/auth/admin";
import { logAdminAction } from "@/platform/audit/log";
import type { ActionResult } from "@/platform/auth/actions";
import type { AdminUserSummary, AdminRole } from "@/domains/users/types";

/** Every user, newest first. Supabase's admin listUsers() is paginated;
 * a single generous page is fine at this app's current scale (README:
 * "single founder account" / a handful of real users) — worth revisiting
 * before this becomes a real multi-user product. */
export async function listUsersAdmin(): Promise<AdminUserSummary[]> {
  await requireAdminOwner();
  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (authError) throw new Error(`Failed to load users: ${authError.message}`);

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name, is_admin, admin_role, is_trainer");
  if (profilesError) throw new Error(`Failed to load profiles: ${profilesError.message}`);

  const profileById = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  return authData.users
    .map(
      (u): AdminUserSummary => ({
        id: u.id,
        email: u.email ?? null,
        fullName: profileById.get(u.id)?.full_name ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: profileById.get(u.id)?.is_admin ?? false,
        adminRole: (profileById.get(u.id)?.admin_role as AdminRole | null) ?? null,
        isTrainer: profileById.get(u.id)?.is_trainer ?? false,
      })
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getUserAdmin(id: string): Promise<AdminUserSummary | null> {
  await requireAdminOwner();
  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(id);
  if (authError || !authData.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, is_admin, admin_role, is_trainer")
    .eq("id", id)
    .maybeSingle();

  return {
    id: authData.user.id,
    email: authData.user.email ?? null,
    fullName: profile?.full_name ?? null,
    createdAt: authData.user.created_at,
    lastSignInAt: authData.user.last_sign_in_at ?? null,
    isAdmin: profile?.is_admin ?? false,
    adminRole: (profile?.admin_role as AdminRole | null) ?? null,
    isTrainer: profile?.is_trainer ?? false,
  };
}

/** Owner-only, same pattern as setUserAdminStatus — trainer status is a
 * different axis (access to other customers' data, not to this admin
 * tool) but the same "only the platform can grant this, never the user
 * themselves" rule applies. No self-service application/vetting flow
 * exists yet (see [[areta-trainer-b2b2c-vision]] memory) — this is the
 * only way to turn an account into a trainer today. */
export async function setUserTrainerStatus(targetUserId: string, isTrainer: boolean): Promise<ActionResult> {
  const { user: currentUser } = await requireAdminOwner();

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_trainer: isTrainer }).eq("id", targetUserId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? null,
    action: "user_trainer_status_changed",
    targetType: "user",
    targetId: targetUserId,
    detail: { isTrainer },
  });

  return { ok: true, data: undefined };
}

/** Deliberately refuses to let an owner change their own role from this
 * UI at all — with typically one or two real owners, an accidental
 * self-demotion (or a slipped click setting adminRole to something the
 * is_admin/admin_role check constraint then rejects) could lock the only
 * owner out of the portal that's the sole way to fix it. Use SQL
 * directly for that, same as how every admin account so far was
 * originally granted.
 *
 * `currentUserId` used to be a caller-supplied argument (trusted from a
 * client component prop) — that let anyone who invoked this Server
 * Action directly, bypassing the page it's normally rendered from, pass
 * an arbitrary `currentUserId` and grant themselves owner access. Fixed
 * 2026-08-06: the caller's identity is now derived from their own
 * session via requireAdminOwner(), never taken as input. */
export async function setUserAdminStatus(
  targetUserId: string,
  next: { isAdmin: boolean; adminRole: AdminRole | null }
): Promise<ActionResult> {
  const { user: currentUser } = await requireAdminOwner();
  if (targetUserId === currentUser.id) {
    return { ok: false, error: "You can't change your own admin role from here." };
  }
  if (next.isAdmin && !next.adminRole) {
    return { ok: false, error: "Choose a role (owner or reviewer) when granting admin access." };
  }

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("profiles")
    .select("is_admin, admin_role")
    .eq("id", targetUserId)
    .maybeSingle();

  const { error } = await admin
    .from("profiles")
    .update({
      is_admin: next.isAdmin,
      admin_role: next.isAdmin ? next.adminRole : null,
    })
    .eq("id", targetUserId);

  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? null,
    action: "user_role_changed",
    targetType: "user",
    targetId: targetUserId,
    detail: {
      from: { isAdmin: before?.is_admin ?? false, adminRole: before?.admin_role ?? null },
      to: { isAdmin: next.isAdmin, adminRole: next.isAdmin ? next.adminRole : null },
    },
  });

  return { ok: true, data: undefined };
}

/** The first account-deletion path anywhere in this app (README "Known
 * gaps": no self-serve deletion exists either). Deletes the auth.users
 * row via the Supabase admin API; every table that references it
 * cascades (profiles.id on delete cascade, and everything hanging off
 * that), except experts/expert_claims/limitation_rules.reviewed_by,
 * fixed to ON DELETE SET NULL in migration 0063 specifically so this
 * doesn't fail for anyone who's ever reviewed content. No further
 * confirmation happens server-side — the UI's type-the-email-to-confirm
 * is the only gate, so don't add a second caller of this without its own
 * equivalent friction. */
export async function deleteUserAdmin(targetUserId: string): Promise<ActionResult> {
  const { user: currentUser } = await requireAdminOwner();
  if (targetUserId === currentUser.id) {
    return { ok: false, error: "You can't delete your own account from here." };
  }

  const admin = createAdminClient();

  // Fetched before deletion purely so the audit log entry is readable
  // after the fact — the target row (and its email) won't exist anymore.
  const { data: targetBefore } = await admin.auth.admin.getUserById(targetUserId);

  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? null,
    action: "user_deleted",
    targetType: "user",
    targetId: targetUserId,
    detail: { email: targetBefore.user?.email ?? null },
  });

  return { ok: true, data: undefined };
}
