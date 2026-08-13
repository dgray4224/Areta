import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Sends a push notification to every device a user has registered
 * (device_push_tokens, populated by the mobile app's
 * lib/push/registerPushToken.ts — see areta-mobile's Phase 2
 * enhancement roadmap, 2026-08-13). Best-effort: a user with zero
 * registered tokens (notifications never enabled, or an Android/web
 * session with no push support) is a normal, silent no-op, not an
 * error — callers should never let a failure here fail the caller's
 * own operation (the weekly review itself already succeeded by the
 * time this runs).
 *
 * `screen` matches areta-mobile's app/_layout.tsx SCREEN_ROUTES keys —
 * keep the two in sync if a new notification type is added.
 */
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; screen: string },
  supabase: SupabaseClient<Database>
): Promise<void> {
  const { data: tokens, error } = await supabase.from("device_push_tokens").select("token").eq("user_id", userId);
  if (error || !tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body,
    data: { screen: notification.screen },
  }));

  try {
    await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    // Not parsing/acting on Expo's per-token error response (e.g.
    // DeviceNotRegistered for an uninstalled app) yet -- device_push_tokens
    // has no cleanup path for stale tokens, same "worth a sweep if volume
    // ever justifies it" posture as mobile_bridge_codes' migration comment.
    // A stale token just fails silently on Expo's side; not the caller's
    // problem.
  } catch {
    // Network failure talking to Expo -- swallow, see doc comment above.
  }
}
