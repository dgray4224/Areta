"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { requireUser } from "@/platform/auth/session";
import type { ActionResult } from "@/platform/auth/actions";
import { getCalendarProvider, isProviderConfigured } from "@/platform/calendar/get-provider";
import { verifyAppleCredentials } from "@/platform/calendar/apple-provider";
import type { CalendarProviderId } from "@/platform/calendar/types";
import { upsertConnection, disconnectConnection } from "@/domains/calendar/connections-service";
import { appleConnectSchema } from "@/domains/calendar/schema";

const STATE_COOKIE = "calendar_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10;
// App-specific passwords don't expire on a schedule — this sentinel just
// keeps token_expires_at NOT NULL without implying a real expiry (see the
// migration comment on calendar_connections).
const APPLE_EXPIRES_AT_SENTINEL = "9999-12-31T23:59:59.000Z";

async function beginOAuthConnect(providerId: "google" | "microsoft"): Promise<void> {
  await requireUser();

  if (!isProviderConfigured(providerId)) {
    redirect(`/settings/calendar?error=not_configured`);
  }

  const origin = (await headers()).get("origin");
  if (!origin) {
    redirect(`/settings/calendar?error=missing_origin`);
  }

  const state = crypto.randomUUID();
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  const provider = getCalendarProvider(providerId);
  const redirectUri = `${origin}/auth/calendar/${providerId}/callback`;
  redirect(provider.getAuthUrl!(state, redirectUri));
}

export async function beginGoogleCalendarConnect(): Promise<void> {
  await beginOAuthConnect("google");
}

export async function beginMicrosoftCalendarConnect(): Promise<void> {
  await beginOAuthConnect("microsoft");
}

/** Apple has no OAuth consent screen to fall back on for debugging, so a
 * verification round-trip (real CalDAV discovery) happens before anything
 * is stored — success both confirms the credentials work and doubles as
 * the "test connection" step. */
export async function connectAppleCalendar(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = appleConnectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const verified = await verifyAppleCredentials(
    parsed.data.appleId,
    parsed.data.appSpecificPassword
  );
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  await upsertConnection(user.id, "apple", {
    accessToken: null,
    refreshToken: parsed.data.appSpecificPassword,
    expiresAt: APPLE_EXPIRES_AT_SENTINEL,
    scope: "caldav",
    accountEmail: verified.data.accountEmail,
  });

  return { ok: true, data: undefined };
}

export async function disconnectCalendar(provider: CalendarProviderId): Promise<ActionResult> {
  const user = await requireUser();
  await disconnectConnection(user.id, provider);
  return { ok: true, data: undefined };
}
