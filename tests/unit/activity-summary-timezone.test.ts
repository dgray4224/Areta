import { describe, expect, it } from "vitest";
import { localDateString, localHour, localDayUtcRange } from "@/domains/activity-summary/timezone";

describe("localDateString", () => {
  it("resolves a UTC-late-night instant to the prior local day west of UTC", () => {
    // 2am UTC on Aug 3 is 7pm the prior day (Aug 2) in Pacific.
    const instant = new Date("2026-08-03T02:00:00Z");
    expect(localDateString(instant, "America/Los_Angeles")).toBe("2026-08-02");
  });

  it("matches the UTC date when timezone is UTC", () => {
    const instant = new Date("2026-08-03T02:00:00Z");
    expect(localDateString(instant, "UTC")).toBe("2026-08-03");
  });
});

describe("localHour", () => {
  it("returns 0 (not 24) for local midnight", () => {
    const instant = new Date("2026-08-03T07:00:00Z"); // midnight Pacific (UTC-7 in August)
    expect(localHour(instant, "America/Los_Angeles")).toBe(0);
  });

  it("returns the correct local hour for a non-midnight instant", () => {
    const instant = new Date("2026-08-02T23:00:00Z"); // 4pm Pacific
    expect(localHour(instant, "America/Los_Angeles")).toBe(16);
  });
});

describe("localDayUtcRange", () => {
  it("computes a 24-hour range for a UTC day", () => {
    const { start, end } = localDayUtcRange("2026-08-02", "UTC");
    expect(start.toISOString()).toBe("2026-08-02T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });

  it("computes the correct range for a non-UTC zone", () => {
    // Pacific is UTC-7 in August (daylight saving) -- local midnight Aug 2
    // is 07:00 UTC Aug 2, and the next local midnight is 07:00 UTC Aug 3.
    const { start, end } = localDayUtcRange("2026-08-02", "America/Los_Angeles");
    expect(start.toISOString()).toBe("2026-08-02T07:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-03T07:00:00.000Z");
  });

  it("handles a DST fall-back transition day (25-hour local day) without crashing", () => {
    // US fall-back in 2026 is Sunday, November 1st.
    const { start, end } = localDayUtcRange("2026-11-01", "America/New_York");
    const hours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    expect(hours).toBe(25);
  });

  it("handles a DST spring-forward transition day (23-hour local day) without crashing", () => {
    // US spring-forward in 2026 is Sunday, March 8th.
    const { start, end } = localDayUtcRange("2026-03-08", "America/New_York");
    const hours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    expect(hours).toBe(23);
  });

  it("a log an hour before local midnight falls in the correct (prior) day's range", () => {
    const dayBefore = localDayUtcRange("2026-08-02", "America/Los_Angeles");
    const sameDay = localDayUtcRange("2026-08-03", "America/Los_Angeles");
    const lateNightLog = new Date("2026-08-03T06:00:00Z"); // 11pm Pacific on Aug 2

    expect(lateNightLog >= dayBefore.start && lateNightLog < dayBefore.end).toBe(true);
    expect(lateNightLog >= sameDay.start && lateNightLog < sameDay.end).toBe(false);
  });
});
