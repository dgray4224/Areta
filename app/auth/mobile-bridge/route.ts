import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/platform/supabase/server";
import { consumeMobileBridgeCode } from "@/platform/auth/mobile-bridge-codes";
import { resolveOrigin } from "@/platform/http/resolve-origin";

/** Deliberately a small allowlist, not "any relative path" -- this route
 * sets a real session cookie and then redirects wherever `next` says, so an
 * unvalidated value would be an open redirect straight out of a freshly
 * authenticated session. */
const ALLOWED_NEXT_PATHS = new Set(["/settings/calendar"]);
const DEFAULT_NEXT_PATH = "/settings/calendar";

/**
 * Landed on from the mobile app's in-app browser (see
 * app/api/auth/mobile-bridge/route.ts, which mints the `code` this route
 * consumes). No cookie session exists yet in this browser tab -- that's the
 * whole point -- so this intentionally has no auth check of its own beyond
 * the single-use code itself.
 */
export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && ALLOWED_NEXT_PATHS.has(nextParam) ? nextParam : DEFAULT_NEXT_PATH;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_bridge_code", origin));
  }

  const tokens = await consumeMobileBridgeCode(code);
  if (!tokens) {
    return NextResponse.redirect(new URL("/login?error=bridge_code_invalid", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=bridge_session_failed", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
