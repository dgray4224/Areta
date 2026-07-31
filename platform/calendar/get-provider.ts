import "server-only";
import { getServerEnv } from "@/platform/env.server";
import type { CalendarProvider } from "@/platform/calendar/provider";
import type { CalendarProviderId } from "@/platform/calendar/types";
import { GoogleCalendarProvider } from "@/platform/calendar/google-provider";
import { MicrosoftCalendarProvider } from "@/platform/calendar/microsoft-provider";
import { AppleCalendarProvider } from "@/platform/calendar/apple-provider";

/** Single place that knows which concrete CalendarProvider to use per
 * provider id — domain code never imports a concrete provider class
 * directly, mirroring platform/ai/get-provider.ts. Throws if Google/
 * Microsoft are requested without their client id/secret configured —
 * check isProviderConfigured() first in any UI that lets the user pick a
 * provider, so a missing env var surfaces as "Not available" rather than a
 * 500 from a dead Connect button. */
export function getCalendarProvider(providerId: CalendarProviderId): CalendarProvider {
  const env = getServerEnv();
  switch (providerId) {
    case "google": {
      if (!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) {
        throw new Error("Google Calendar is not configured.");
      }
      return new GoogleCalendarProvider(
        env.GOOGLE_CALENDAR_CLIENT_ID,
        env.GOOGLE_CALENDAR_CLIENT_SECRET
      );
    }
    case "microsoft": {
      if (!env.MICROSOFT_CALENDAR_CLIENT_ID || !env.MICROSOFT_CALENDAR_CLIENT_SECRET) {
        throw new Error("Microsoft Calendar is not configured.");
      }
      return new MicrosoftCalendarProvider(
        env.MICROSOFT_CALENDAR_CLIENT_ID,
        env.MICROSOFT_CALENDAR_CLIENT_SECRET
      );
    }
    case "apple":
      return new AppleCalendarProvider();
  }
}

/** Apple needs no client id/secret (only CALENDAR_TOKEN_ENCRYPTION_KEY,
 * which every provider needs since it's used to encrypt whatever credential
 * gets stored — an OAuth token or an app-specific password alike). */
export function isProviderConfigured(providerId: CalendarProviderId): boolean {
  const env = getServerEnv();
  if (!env.CALENDAR_TOKEN_ENCRYPTION_KEY) return false;
  switch (providerId) {
    case "google":
      return Boolean(env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET);
    case "microsoft":
      return Boolean(env.MICROSOFT_CALENDAR_CLIENT_ID && env.MICROSOFT_CALENDAR_CLIENT_SECRET);
    case "apple":
      return true;
  }
}
