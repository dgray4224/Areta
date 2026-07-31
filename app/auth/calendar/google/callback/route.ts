import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/platform/auth/session";
import { getCalendarProvider } from "@/platform/calendar/get-provider";
import { upsertConnection } from "@/domains/calendar/connections-service";

const STATE_COOKIE = "calendar_oauth_state";

/** Landed on after the user consents on Google's screen. Verifies the
 * state cookie set by beginGoogleCalendarConnect (domains/calendar/connect-actions.ts)
 * before exchanging the code, same CSRF-protection shape as any OAuth
 * redirect flow. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const { searchParams, origin } = new URL(request.url);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  if (providerError) {
    console.error("[auth/calendar/google] provider returned error:", providerError);
    return NextResponse.redirect(new URL("/settings/calendar?error=google_denied", origin));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    console.error("[auth/calendar/google] missing or mismatched state");
    return NextResponse.redirect(new URL("/settings/calendar?error=invalid_state", origin));
  }

  const provider = getCalendarProvider("google");
  const redirectUri = `${origin}/auth/calendar/google/callback`;
  const result = await provider.exchangeCode!(code, redirectUri);

  if (!result.ok) {
    console.error("[auth/calendar/google] exchangeCode failed:", result.error);
    return NextResponse.redirect(new URL("/settings/calendar?error=google_exchange_failed", origin));
  }

  await upsertConnection(user.id, "google", result.data);
  return NextResponse.redirect(new URL("/settings/calendar?connected=google", origin));
}
