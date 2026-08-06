/** Admin ops/monitoring (Phase D) — read-only visibility into what's
 * failing in production. Not a product domain (CLAUDE.md's domain list),
 * but its own module rather than bolted onto domains/review or
 * domains/workoutplan, since it reads across both and is inherently a
 * platform/ops concern, same reasoning as domains/expertregistry. */

export type AiRun = {
  id: string;
  userId: string;
  /** From profiles.full_name — ai_runs.user_id FKs to auth.users, which
   * PostgREST can't embed directly from a regular (non-service-role)
   * client, and auth.users' email isn't exposed via the public schema
   * either way. Null falls back to a shortened user id in the UI. */
  userName: string | null;
  purpose: string;
  model: string;
  success: boolean;
  error: string | null;
  createdAt: string;
};

/** admin_actions (migration 0064) — append-only audit trail for admin
 * actions (role changes, deletions, content-review decisions). actorEmail
 * is a snapshot taken at write time, not a live join, so it survives the
 * actor's account later being deleted. */
export type AdminAction = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};
