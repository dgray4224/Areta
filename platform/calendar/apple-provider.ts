import "server-only";
import ICAL from "ical.js";
import { createDAVClient } from "tsdav";
import type { CalendarProvider } from "@/platform/calendar/provider";
import type { CalendarResult, NormalizedEvent, TokenSet } from "@/platform/calendar/types";

const SERVER_URL = "https://caldav.icloud.com";

/**
 * CalDAV client for iCloud — Apple has no OAuth API for calendar access, so
 * this authenticates with Basic Auth using an Apple ID + an app-specific
 * password the user generates themselves at appleid.apple.com. `tsdav`
 * handles discovery (principal → calendar-home-set) and the CalDAV
 * `calendar-query` REPORT; `ical.js` parses the returned VEVENT blocks.
 * This is the one provider that only implements `listEvents` — connection
 * happens through `connectAppleCalendar` (domains/calendar/connect-actions.ts),
 * not the OAuth methods on CalendarProvider.
 *
 * Known v1 limitation: a recurring event (RRULE) is returned as a single
 * occurrence using its master DTSTART/DTEND — RRULE expansion into each
 * individual occurrence isn't implemented, so a recurring event won't show
 * up on every date it actually recurs on. Google/Microsoft don't have this
 * gap (both expand recurrence server-side via singleEvents=true /
 * calendarView).
 */
export class AppleCalendarProvider implements CalendarProvider {
  async listEvents(
    credentials: TokenSet,
    range: { timeMin: string; timeMax: string }
  ): Promise<CalendarResult<NormalizedEvent[]>> {
    if (!credentials.accountEmail) {
      return { ok: false, error: "No Apple ID on this connection." };
    }
    try {
      const client = await createDAVClient({
        serverUrl: SERVER_URL,
        credentials: { username: credentials.accountEmail, password: credentials.refreshToken },
        authMethod: "Basic",
        defaultAccountType: "caldav",
      });
      const calendars = await client.fetchCalendars();

      const events: NormalizedEvent[] = [];
      for (const calendar of calendars) {
        const objects = await client.fetchCalendarObjects({
          calendar,
          timeRange: { start: range.timeMin, end: range.timeMax },
        });
        for (const object of objects) {
          if (typeof object.data !== "string") continue;
          events.push(...parseICalEvents(object.data));
        }
      }
      return { ok: true, data: events };
    } catch (error) {
      return {
        ok: false,
        error: `Apple Calendar fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }
}

/** Validates Apple ID + app-specific password by doing a real CalDAV
 * discovery round-trip — success both confirms the credentials work and
 * doubles as the "test connection" step before anything is stored, so
 * there's no separate verification call needed. */
export async function verifyAppleCredentials(
  appleId: string,
  appSpecificPassword: string
): Promise<CalendarResult<{ accountEmail: string }>> {
  try {
    await createDAVClient({
      serverUrl: SERVER_URL,
      credentials: { username: appleId, password: appSpecificPassword },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    return { ok: true, data: { accountEmail: appleId } };
  } catch (error) {
    return {
      ok: false,
      error: `Couldn't connect to iCloud Calendar: ${error instanceof Error ? error.message : "check your Apple ID and app-specific password"}`,
    };
  }
}

/** Exported for direct unit testing against static .ics fixtures — the
 * CalDAV network call itself isn't exercised in tests, just this parsing. */
export function parseICalEvents(icsData: string): NormalizedEvent[] {
  const jcalData = ICAL.parse(icsData);
  const component = new ICAL.Component(jcalData);
  const vevents = component.getAllSubcomponents("vevent");

  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);
    return {
      id: event.uid,
      title: event.summary || "(No title)",
      startsAt: event.startDate.toJSDate().toISOString(),
      endsAt: event.endDate.toJSDate().toISOString(),
      allDay: event.startDate.isDate,
      source: "apple" as const,
    };
  });
}
