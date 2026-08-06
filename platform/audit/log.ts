import "server-only";
import { createAdminClient } from "@/platform/supabase/admin";
import type { Json } from "@/platform/db/types";

/** Append-only audit trail for admin actions (migration 0064). Always
 * call this from server code that has already run requireAdmin() /
 * requireAdminOwner() itself — this helper doesn't re-check
 * authorization, it just records what an already-authorized caller did.
 * Uses the service-role client since writes should never be blocked by
 * RLS (nothing should ever silently fail to get logged), matching
 * admin_actions having no insert policy of its own.
 *
 * Never throws — a logging failure must not roll back or block the real
 * admin action it's describing. Logs to the server console instead so a
 * broken audit pipe is at least visible in Vercel logs. */
export async function logAdminAction(input: {
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_actions").insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    detail: (input.detail ?? null) as Json | null,
  });

  if (error) {
    console.error(`[admin_actions] failed to log "${input.action}" on ${input.targetType}:`, error.message);
  }
}
