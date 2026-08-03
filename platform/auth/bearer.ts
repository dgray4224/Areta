import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/platform/env";
import type { Database } from "@/platform/db/types";

/**
 * Authenticates a request via a Supabase access-token Bearer header rather
 * than the cookie-based session platform/supabase/server.ts uses — a
 * native app has no cookies to send. Mirrors app/api/health-sync/route.ts's
 * original inline auth block, extracted here since the exercise/nutrition/
 * calendar routes need the identical logic. Reuses the caller's own access
 * token (no service-role bypass), so RLS applies to every request exactly
 * as it does for the web app.
 */
export async function authenticateBearerRequest(
  request: Request
): Promise<{ supabase: SupabaseClient<Database>; userId: string } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) return null;

  const supabase = createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return { supabase, userId: user.id };
}
