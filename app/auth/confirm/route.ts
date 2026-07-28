import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/platform/supabase/server";

/** Landed on from the confirmation email link (see
 * supabase/templates/confirmation.html). Exchanges the token hash for a
 * session via verifyOtp — required because @supabase/ssr's cookie-based
 * client doesn't pick up Supabase's default implicit-flow /verify redirect
 * on its own. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
}
