import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/platform/supabase/server";

/**
 * Landed on from the confirmation email link. `signUpWithPassword` sets
 * `emailRedirectTo` to this route, so Supabase's own /auth/v1/verify
 * endpoint redirects here after verifying — with either a PKCE `code` (the
 * default for @supabase/ssr's PKCE-flow client) or, if using the custom
 * token_hash-based template (see supabase/templates/confirmation.html),
 * `token_hash` + `type`. Handling both means this works whether or not
 * custom SMTP/templates are configured on the hosted project.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth/confirm] exchangeCodeForSession failed:", error.message, error.status);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth/confirm] verifyOtp failed:", error.message, error.status);
  } else {
    console.error("[auth/confirm] missing code and token_hash/type", Object.fromEntries(searchParams));
  }

  return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
}
