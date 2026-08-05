import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AdminRole = "owner" | "reviewer";

export type AdminSession = {
  user: User;
  adminRole: AdminRole;
};

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
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, admin_role")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return { user, adminRole: (profile.admin_role as AdminRole) ?? "reviewer" };
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
