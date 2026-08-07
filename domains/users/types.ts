/** Admin user management (Phase E) — the most sensitive area of the
 * admin portal, gated owner-only throughout. Reads/writes here go
 * through the service-role client (platform/supabase/admin.ts), not the
 * regular RLS-scoped one: `auth.users` (email, signup date) isn't
 * reachable via PostgREST from a normal client at all, and there's no
 * RLS policy letting one user write another's `profiles` row either.
 * Every function in domains/users/service.ts calls requireAdminOwner()
 * itself (see 2026-08-06 fix) — page-level gating alone was not
 * sufficient, since Next.js Server Actions are independently callable
 * regardless of which page imports them; the "explicit authorization
 * check first" createAdminClient()'s own doc comment requires has to
 * live inside the action, not just the page that renders its form. */

export type AdminRole = "owner" | "reviewer";

export type AdminUserSummary = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  /** Trainer role (2026-08-06) — a different axis than isAdmin/adminRole
   * entirely: gates access to *other customers'* data via trainer_clients,
   * not access to this internal admin tool. Same owner-only-settable
   * protection (setUserTrainerStatus), same profiles-column-privilege
   * guard (migration 0065/0066). */
  isTrainer: boolean;
};

/** Admin-side view of a pending "become a trainer" self-service request
 * (migration 0087) -- domains/trainer/types.ts's MyTrainerRoleRequest is
 * the requester's own view of the same underlying row. */
export type TrainerRoleRequestSummary = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  message: string | null;
  createdAt: string;
};
