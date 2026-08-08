import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/platform/supabase/admin";
import { encryptToken, decryptToken } from "@/platform/calendar/token-crypto";

const CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes -- just long enough to open the browser tab

/** Mints a single-use code carrying the mobile app's own Supabase session
 * (already bearer-authenticated by the caller), so an in-app browser tab
 * can pick it up and become that same signed-in user. */
export async function createMobileBridgeCode(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  const supabase = createAdminClient();
  const { error } = await supabase.from("mobile_bridge_codes").insert({
    code,
    user_id: userId,
    access_token_encrypted: encryptToken(accessToken),
    refresh_token_encrypted: encryptToken(refreshToken),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) {
    throw new Error(`Failed to create mobile bridge code: ${error.message}`);
  }
  return code;
}

/** Consumes a bridge code: valid exactly once, within its TTL. Returns null
 * for anything else (unknown, expired, already-used) rather than
 * distinguishing why -- the caller (an unauthenticated browser tab) just
 * needs a yes/no. */
export async function consumeMobileBridgeCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mobile_bridge_codes")
    .select("access_token_encrypted, refresh_token_encrypted, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (error || !data || data.used_at || new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Mark used before returning -- best-effort single-use. A genuine race
  // (two requests for the same code within milliseconds) is not a realistic
  // threat here: the code is only ever handed to one browser tab.
  await supabase.from("mobile_bridge_codes").update({ used_at: new Date().toISOString() }).eq("code", code);

  return {
    accessToken: decryptToken(data.access_token_encrypted),
    refreshToken: decryptToken(data.refresh_token_encrypted),
  };
}
