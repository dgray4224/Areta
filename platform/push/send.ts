import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TIMEOUT_MS = 8000;
// Expo's documented max messages per request to /push/send.
const EXPO_PUSH_BATCH_SIZE = 100;

// Two notifications exist today: "review" (weekly-review-ready) and
// "insights" (a high-score record/streak insight from the
// generate-insights cron, Phase 3 2026-08-14 -- both land on the mobile
// Review tab, where the insight feed lives). A real string union (not
// `string`) so a typo'd/unsynced value is a compile error here, not just
// a doc-comment convention -- areta-mobile's app/_layout.tsx
// SCREEN_ROUTES must be kept mirroring this exact set of keys; there's
// no shared package between the two repos to enforce that automatically.
export type NotificationScreen = "review" | "insights";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: { screen: NotificationScreen };
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<void> {
  for (const batch of chunk(messages, EXPO_PUSH_BATCH_SIZE)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXPO_PUSH_TIMEOUT_MS);
    try {
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error(`[push] Expo push API returned ${response.status} for a batch of ${batch.length} message(s)`);
      }
      // Not parsing/acting on Expo's per-token error response (e.g.
      // DeviceNotRegistered for an uninstalled app) yet -- device_push_tokens
      // has no cleanup path for stale tokens, same "worth a sweep if volume
      // ever justifies it" posture as mobile_bridge_codes' migration comment.
      // A stale token just fails silently on Expo's side; not the caller's
      // problem.
    } catch (err) {
      // Network failure or timeout talking to Expo -- logged (unlike the
      // original version of this function, which swallowed this silently;
      // a feature that's currently guaranteed to fail 100% of the time
      // until APNs credentials are set up needs *some* signal, and this
      // is also the only place a real future failure would ever surface).
      console.error(
        `[push] Failed to send a batch of ${batch.length} message(s):`,
        err instanceof Error ? err.message : err
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Sends a push notification to every device registered (device_push_tokens,
 * populated by the mobile app's lib/push/registerPushToken.ts — see
 * areta-mobile's Phase 2 enhancement roadmap, 2026-08-13) for each of
 * these recipients, batched across recipients into as few Expo API
 * requests as possible (EXPO_PUSH_BATCH_SIZE) rather than one request
 * per user — the weekly-review cron can have many users due the same
 * day, all sharing the same title/body. Best-effort throughout: a
 * recipient with zero registered tokens is a normal, silent no-op, and
 * a send failure is logged but never thrown — callers should never let
 * a failure here fail their own operation (the weekly review itself
 * already succeeded by the time this runs).
 */
export async function sendPushToUsers(
  recipients: { userId: string; title: string; body: string; screen: NotificationScreen }[],
  supabase: SupabaseClient<Database>
): Promise<void> {
  if (recipients.length === 0) return;

  const { data: tokenRows, error } = await supabase
    .from("device_push_tokens")
    .select("user_id, token")
    .in(
      "user_id",
      recipients.map((r) => r.userId)
    );
  if (error) {
    console.error("[push] Failed to load device_push_tokens:", error.message);
    return;
  }
  if (!tokenRows || tokenRows.length === 0) return;

  const byUserId = new Map(recipients.map((r) => [r.userId, r]));
  const messages: ExpoPushMessage[] = [];
  for (const row of tokenRows) {
    const recipient = byUserId.get(row.user_id);
    if (!recipient) continue; // shouldn't happen (query is scoped to recipients' ids), defensive only
    messages.push({ to: row.token, title: recipient.title, body: recipient.body, data: { screen: recipient.screen } });
  }

  await sendExpoPushBatch(messages);
}

/** Single-recipient convenience wrapper around sendPushToUsers, for a
 * call site that only ever has one user to notify at a time. Prefer
 * sendPushToUsers directly when notifying many users in one request
 * (e.g. a cron iterating a due-today list) so they share Expo API
 * requests instead of firing one each. */
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; screen: NotificationScreen },
  supabase: SupabaseClient<Database>
): Promise<void> {
  await sendPushToUsers([{ userId, ...notification }], supabase);
}
