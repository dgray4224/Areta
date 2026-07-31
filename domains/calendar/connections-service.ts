"use server";

import { createClient } from "@/platform/supabase/server";
import { encryptToken, decryptToken } from "@/platform/calendar/token-crypto";
import { getCalendarProvider } from "@/platform/calendar/get-provider";
import type { CalendarProviderId, TokenSet } from "@/platform/calendar/types";
import type { CalendarConnection } from "@/domains/calendar/schema";

export async function getConnections(userId: string): Promise<CalendarConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("provider, external_account_email, connected_at")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load calendar connections: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    provider: row.provider as CalendarProviderId,
    accountEmail: row.external_account_email,
    connectedAt: row.connected_at,
  }));
}

export async function upsertConnection(
  userId: string,
  provider: CalendarProviderId,
  tokenSet: TokenSet
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_connections").upsert(
    {
      user_id: userId,
      provider,
      external_account_email: tokenSet.accountEmail ?? null,
      access_token_encrypted: tokenSet.accessToken ? encryptToken(tokenSet.accessToken) : null,
      refresh_token_encrypted: encryptToken(tokenSet.refreshToken),
      token_expires_at: tokenSet.expiresAt,
      scope: tokenSet.scope,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) {
    throw new Error(`Failed to save calendar connection: ${error.message}`);
  }
}

export async function disconnectConnection(
  userId: string,
  provider: CalendarProviderId
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) {
    throw new Error(`Failed to disconnect calendar: ${error.message}`);
  }
}

const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * The one place that touches raw (decrypted) credentials. Decrypts, and for
 * OAuth providers refreshes the access token if it's within the skew window
 * (persisting the refreshed token back), before handing credentials to a
 * CalendarProvider. Apple's app-specific password never expires on a
 * schedule, so there's nothing to refresh — it's returned as-is.
 * Returns null if there's no connection, or if a refresh fails (a revoked/
 * expired credential) — callers treat that as "no events from this
 * provider," never as a thrown error, so one broken connection can't break
 * the whole dashboard load.
 */
export async function getValidCredentials(
  userId: string,
  provider: CalendarProviderId
): Promise<TokenSet | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_connections")
    .select(
      "external_account_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, scope"
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return null;

  let refreshToken: string;
  try {
    refreshToken = decryptToken(data.refresh_token_encrypted);
  } catch {
    return null;
  }
  const accountEmail = data.external_account_email ?? undefined;

  if (provider === "apple") {
    return {
      accessToken: null,
      refreshToken,
      expiresAt: data.token_expires_at,
      scope: data.scope,
      accountEmail,
    };
  }

  const expiresAtMs = new Date(data.token_expires_at).getTime();
  const accessToken = data.access_token_encrypted ? decryptToken(data.access_token_encrypted) : null;

  if (accessToken && expiresAtMs - Date.now() > REFRESH_SKEW_MS) {
    return { accessToken, refreshToken, expiresAt: data.token_expires_at, scope: data.scope, accountEmail };
  }

  const calendarProvider = getCalendarProvider(provider);
  if (!calendarProvider.refreshAccessToken) return null;

  const refreshed = await calendarProvider.refreshAccessToken(refreshToken);
  if (!refreshed.ok) return null;

  const tokenSet: TokenSet = { ...refreshed.data, accountEmail };
  await upsertConnection(userId, provider, tokenSet);
  return tokenSet;
}
