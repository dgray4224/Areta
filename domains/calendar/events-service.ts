"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCalendarProvider } from "@/platform/calendar/get-provider";
import type { CalendarProviderId, NormalizedEvent } from "@/platform/calendar/types";
import { getValidCredentials } from "@/domains/calendar/connections-service";
import type { UpcomingEvent } from "@/domains/calendar/schema";
import type { Database } from "@/platform/db/types";

const ALL_PROVIDERS: CalendarProviderId[] = ["google", "microsoft", "apple"];

/**
 * Fetches events across every connected provider and merges them into one
 * sorted list. Deliberately never throws — a broken/revoked connection for
 * one provider degrades to "no events from that provider" (logged as a
 * warning) rather than failing the whole call, since this feeds both the
 * dashboard's "Upcoming events" section and the mobile Calendar tab (see
 * the 3s-timeout wrapper below).
 */
export async function getUpcomingEvents(
  userId: string,
  range: { timeMin: string; timeMax: string },
  client?: SupabaseClient<Database>
): Promise<UpcomingEvent[]> {
  const results = await Promise.all(
    ALL_PROVIDERS.map((providerId) => fetchFromProvider(userId, providerId, range, client))
  );

  return mergeAndSort(results.flat());
}

const UPCOMING_EVENTS_TIMEOUT_MS = 3000;

/** A slow or broken calendar connection must never hold up the caller (a
 * dashboard page load, or a mobile API request) — always resolves within
 * the timeout, falling back to an empty list. getUpcomingEvents already
 * never throws (each provider fails independently), but the try/catch here
 * is defense in depth against a future change to that contract. */
export async function getUpcomingEventsWithTimeout(
  userId: string,
  range: { timeMin: string; timeMax: string },
  client?: SupabaseClient<Database>
): Promise<UpcomingEvent[]> {
  const fetchEvents = getUpcomingEvents(userId, range, client).catch(() => []);
  const timeout = new Promise<UpcomingEvent[]>((resolve) =>
    setTimeout(() => resolve([]), UPCOMING_EVENTS_TIMEOUT_MS)
  );

  return Promise.race([fetchEvents, timeout]);
}

async function fetchFromProvider(
  userId: string,
  providerId: CalendarProviderId,
  range: { timeMin: string; timeMax: string },
  client?: SupabaseClient<Database>
): Promise<NormalizedEvent[]> {
  const credentials = await getValidCredentials(userId, providerId, client);
  if (!credentials) return [];

  try {
    const provider = getCalendarProvider(providerId);
    const result = await provider.listEvents(credentials, range);
    if (!result.ok) {
      console.warn(`[calendar] ${providerId} listEvents failed:`, result.error);
      return [];
    }
    return result.data;
  } catch (error) {
    console.warn(`[calendar] ${providerId} listEvents threw:`, error);
    return [];
  }
}

function mergeAndSort(events: NormalizedEvent[]): UpcomingEvent[] {
  return [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
