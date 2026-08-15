import { describe, expect, it } from "vitest";
import { addDays, getWeekDates, weekStartFor } from "@/platform/ui/week-dates";

/** Regression coverage for the plan-duplication bug found 2026-08-15: the
 * plan generators anchored week_start to whatever weekday they happened to
 * run on and then stepped +7, so one calendar week could end up covered by
 * several active plans (a Sunday ladder and a Wednesday ladder), and the
 * grocery list — which picks exactly one plan per week — silently omitted
 * the other plan's meals. weekStartFor is the normalizer that fixes it. */
describe("weekStartFor", () => {
  it("returns the same date for a Sunday", () => {
    expect(weekStartFor("2026-08-16")).toBe("2026-08-16"); // Sunday
  });

  it("snaps every other weekday back to that week's Sunday", () => {
    // The real duplicate-ladder anchors from the account that surfaced this.
    expect(weekStartFor("2026-08-12")).toBe("2026-08-09"); // Wednesday
    expect(weekStartFor("2026-08-19")).toBe("2026-08-16"); // Wednesday
    expect(weekStartFor("2026-08-15")).toBe("2026-08-09"); // Saturday
    expect(weekStartFor("2026-08-06")).toBe("2026-08-02"); // Thursday
  });

  it("collapses every day of one week onto a single anchor", () => {
    const anchors = getWeekDates("2026-08-19").map(weekStartFor);
    expect(new Set(anchors).size).toBe(1);
    expect(anchors[0]).toBe("2026-08-16");
  });

  it("is idempotent", () => {
    expect(weekStartFor(weekStartFor("2026-08-12"))).toBe(weekStartFor("2026-08-12"));
  });

  it("crosses month and year boundaries", () => {
    expect(weekStartFor("2026-09-01")).toBe("2026-08-30"); // Tue -> prior Sunday, prior month
    expect(weekStartFor("2027-01-01")).toBe("2026-12-27"); // Fri -> prior Sunday, prior year
  });

  it("keeps a normalized ladder on Sundays when stepped by weeks", () => {
    // What the generators do: normalize once, then addDays(+7 * i).
    const start = weekStartFor("2026-08-15");
    const ladder = [0, 1, 2, 3].map((i) => addDays(start, i * 7));
    expect(ladder).toEqual(["2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30"]);
    // Every rung is its own week's anchor — no drift off the boundary.
    expect(ladder.map(weekStartFor)).toEqual(ladder);
  });
});
