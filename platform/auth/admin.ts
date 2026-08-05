import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

export type AdminRole = "owner" | "reviewer";

export type AdminSession = {
  user: User;
  adminRole: AdminRole;
};

export type AdminStatus = {
  isAdmin: boolean;
  adminRole: AdminRole | null;
};

/** Non-redirecting read of admin status — use this in the regular app
 * shell (nav links, etc.) where a non-admin should just see nothing extra,
 * not get bounced. `requireAdmin`/`requireAdminOwner` below build on this
 * for pages that actually need to gate. */
export async function getAdminStatus(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<AdminStatus> {
  const supabase = client ?? (await createClient());
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, admin_role")
    .eq("id", userId)
    .maybeSingle();

  return {
    isAdmin: profile?.is_admin ?? false,
    adminRole: (profile?.admin_role as AdminRole | null) ?? null,
  };
}

/** Use at the top of any Server Component under `app/(admin)`. Redirects
 * anyone without `profiles.is_admin` back to the regular dashboard — this
 * is the actual enforcement (no `middleware.ts` exists in this repo to
 * gate routes at the edge; every protected area checks in its own layout).
 * `admin_role` defaults to the narrower 'reviewer' on the — currently
 * impossible per the `profiles_admin_role_requires_is_admin` check
 * constraint — chance it's ever null while is_admin is true, so a data
 * inconsistency fails closed instead of open. */
export async function requireAdmin(): Promise<AdminSession> {
  const user = await requireUser();
  const status = await getAdminStatus(user.id);

  if (!status.isAdmin) {
    redirect("/dashboard");
  }

  return { user, adminRole: status.adminRole ?? "reviewer" };
}

/** Use at the top of owner-only admin pages (ops, users). Reviewers who
 * navigate here directly (the nav already hides these links from them)
 * get bounced back to the admin dashboard rather than seeing a raw 403. */
export async function requireAdminOwner(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.adminRole !== "owner") {
    redirect("/admin");
  }
  return session;
}
