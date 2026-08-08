import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/platform/auth/session";
import { getCalendarProvider } from "@/platform/calendar/get-provider";
import { upsertConnection } from "@/domains/calendar/connections-service";
import { resolveOrigin } from "@/platform/http/resolve-origin";

const STATE_COOKIE = "calendar_oauth_state";

/** Landed on after the user consents on Microsoft's screen. Same
 * state-cookie verification shape as the Google callback. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const origin = resolveOrigin(request);
  const { searchParams } = new URL(request.url);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  if (providerError) {
    console.error("[auth/calendar/microsoft] provider returned error:", providerError);
    return NextResponse.redirect(new URL("/settings/calendar?error=microsoft_denied", origin));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    console.error("[auth/calendar/microsoft] missing or mismatched state");
    return NextResponse.redirect(new URL("/settings/calendar?error=invalid_state", origin));
  }

  const provider = getCalendarProvider("microsoft");
  const redirectUri = `${origin}/auth/calendar/microsoft/callback`;
  const result = await provider.exchangeCode!(code, redirectUri);

  if (!result.ok) {
    console.error("[auth/calendar/microsoft] exchangeCode failed:", result.error);
    return NextResponse.redirect(new URL("/settings/calendar?error=microsoft_exchange_failed", origin));
  }

  await upsertConnection(user.id, "microsoft", result.data);
  return NextResponse.redirect(new URL("/settings/calendar?connected=microsoft", origin));
}
