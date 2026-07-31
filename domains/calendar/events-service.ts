"use server";

import { getCalendarProvider } from "@/platform/calendar/get-provider";
import type { CalendarProviderId, NormalizedEvent } from "@/platform/calendar/types";
import { getValidCredentials } from "@/domains/calendar/connections-service";
import type { UpcomingEvent } from "@/domains/calendar/schema";

const ALL_PROVIDERS: CalendarProviderId[] = ["google", "microsoft", "apple"];

/**
 * Fetches events across every connected provider and merges them into one
 * sorted list. Deliberately never throws — a broken/revoked connection for
 * one provider degrades to "no events from that provider" (logged as a
 * warning) rather than failing the whole call, since this feeds the
 * dashboard's "Upcoming events" section and a bad connection must not break
 * page load (see the 3s-timeout wrapper in app/(app)/dashboard/data.ts).
 */
export async function getUpcomingEvents(
  userId: string,
  range: { timeMin: string; timeMax: string }
): Promise<UpcomingEvent[]> {
  const results = await Promise.all(
    ALL_PROVIDERS.map((providerId) => fetchFromProvider(userId, providerId, range))
  );

  return mergeAndSort(results.flat());
}

async function fetchFromProvider(
  userId: string,
  providerId: CalendarProviderId,
  range: { timeMin: string; timeMax: string }
): Promise<NormalizedEvent[]> {
  const credentials = await getValidCredentials(userId, providerId);
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
