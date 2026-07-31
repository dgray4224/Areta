import { describe, expect, it } from "vitest";
import { parseICalEvents } from "@/platform/calendar/apple-provider";

const SINGLE_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:single-event-1@example.com
DTSTAMP:20260101T120000Z
DTSTART:20260105T140000Z
DTEND:20260105T150000Z
SUMMARY:Doctor appointment
END:VEVENT
END:VCALENDAR`;

const ALL_DAY_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:all-day-event-1@example.com
DTSTAMP:20260101T120000Z
DTSTART;VALUE=DATE:20260110
DTEND;VALUE=DATE:20260111
SUMMARY:Company holiday
END:VEVENT
END:VCALENDAR`;

const RECURRING_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:recurring-event-1@example.com
DTSTAMP:20260101T120000Z
DTSTART:20260106T090000Z
DTEND:20260106T093000Z
RRULE:FREQ=WEEKLY;COUNT=5
SUMMARY:Weekly standup
END:VEVENT
END:VCALENDAR`;

const NO_TITLE_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:no-title-event-1@example.com
DTSTAMP:20260101T120000Z
DTSTART:20260105T140000Z
DTEND:20260105T150000Z
END:VEVENT
END:VCALENDAR`;

describe("parseICalEvents", () => {
  it("parses a single timed event", () => {
    const events = parseICalEvents(SINGLE_EVENT_ICS);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "single-event-1@example.com",
      title: "Doctor appointment",
      allDay: false,
      source: "apple",
    });
    expect(new Date(events[0].startsAt).toISOString()).toBe("2026-01-05T14:00:00.000Z");
    expect(new Date(events[0].endsAt).toISOString()).toBe("2026-01-05T15:00:00.000Z");
  });

  it("marks a VALUE=DATE event as all-day", () => {
    const events = parseICalEvents(ALL_DAY_EVENT_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].title).toBe("Company holiday");
  });

  it("returns the master occurrence for a recurring event, not each expansion", () => {
    const events = parseICalEvents(RECURRING_EVENT_ICS);
    // Known v1 limitation (see the comment on AppleCalendarProvider):
    // RRULE isn't expanded, so a 5-occurrence weekly event still yields
    // exactly one NormalizedEvent, dated at its DTSTART.
    expect(events).toHaveLength(1);
    expect(new Date(events[0].startsAt).toISOString()).toBe("2026-01-06T09:00:00.000Z");
  });

  it("falls back to a placeholder title when SUMMARY is missing", () => {
    const events = parseICalEvents(NO_TITLE_EVENT_ICS);
    expect(events[0].title).toBe("(No title)");
  });
});
