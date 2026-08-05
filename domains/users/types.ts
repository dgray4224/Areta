/** Admin user management (Phase E) — the most sensitive area of the
 * admin portal, gated owner-only throughout. Reads/writes here go
 * through the service-role client (platform/supabase/admin.ts), not the
 * regular RLS-scoped one: `auth.users` (email, signup date) isn't
 * reachable via PostgREST from a normal client at all, and there's no
 * RLS policy letting one user write another's `profiles` row either.
 * Every function in domains/users/service.ts is only ever called from a
 * page already behind requireAdminOwner() — the "explicit authorization
 * check first" createAdminClient()'s own doc comment requires. */

export type AdminRole = "owner" | "reviewer";

export type AdminUserSummary = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  adminRole: AdminRole | null;
};
