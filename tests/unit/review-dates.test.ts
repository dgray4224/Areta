import { describe, expect, it } from "vitest";

import { reviewWindowFor, weekStartForReviewDay } from "@/domains/review/dates";

/**
 * These cover the bug found on 2026-09-26: the review week was computed
 * as `today - 6`, so the key moved every day and the brief the cron had
 * written became unreachable the morning after. The property that
 * matters is stability — every day of a cycle must resolve to the SAME
 * key — so that is what most of these assert.
 */

// 2026-09-20 is a Sunday; the week that follows it runs to Saturday 26th.
const CYCLE = ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"];

describe("weekStartForReviewDay", () => {
  it("returns the review day itself on the review day", () => {
    expect(weekStartForReviewDay("2026-09-20", 0)).toBe("2026-09-20");
  });

  it("holds the same key for every day of the cycle", () => {
    for (const day of CYCLE) {
      expect(weekStartForReviewDay(day, 0), day).toBe("2026-09-20");
    }
  });

  it("rolls over to the next cycle on the next review day", () => {
    expect(weekStartForReviewDay("2026-09-27", 0)).toBe("2026-09-27");
  });

  it("anchors to whatever day the user picked, not to Sunday", () => {
    // Wednesday = 3. The cycle containing Sunday the 20th began Wed 16th.
    expect(weekStartForReviewDay("2026-09-20", 3)).toBe("2026-09-16");
    expect(weekStartForReviewDay("2026-09-16", 3)).toBe("2026-09-16");
    expect(weekStartForReviewDay("2026-09-22", 3)).toBe("2026-09-16");
    expect(weekStartForReviewDay("2026-09-23", 3)).toBe("2026-09-23");
  });

  it("gives every review day a key that is actually that weekday", () => {
    for (let reviewDay = 0; reviewDay <= 6; reviewDay++) {
      for (const day of CYCLE) {
        const key = weekStartForReviewDay(day, reviewDay);
        expect(new Date(`${key}T00:00:00Z`).getUTCDay(), `${day} / day ${reviewDay}`).toBe(reviewDay);
      }
    }
  });

  it("never returns a key in the future", () => {
    for (let reviewDay = 0; reviewDay <= 6; reviewDay++) {
      for (const day of CYCLE) {
        expect(weekStartForReviewDay(day, reviewDay) <= day).toBe(true);
      }
    }
  });

  it("crosses a month boundary", () => {
    // 2026-10-04 is a Sunday, so the Saturday before belongs to 09-27.
    expect(weekStartForReviewDay("2026-10-03", 0)).toBe("2026-09-27");
    expect(weekStartForReviewDay("2026-10-04", 0)).toBe("2026-10-04");
  });
});

describe("reviewWindowFor", () => {
  it("covers the seven days ending the day before the anchor", () => {
    expect(reviewWindowFor("2026-09-20")).toEqual({ start: "2026-09-13", end: "2026-09-19" });
  });

  it("never includes the anchor day or anything after it", () => {
    const { start, end } = reviewWindowFor("2026-09-20");
    expect(end < "2026-09-20").toBe(true);
    expect(start < end).toBe(true);
  });

  it("is exactly seven days long", () => {
    const { start, end } = reviewWindowFor("2026-09-20");
    const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
    expect(days).toBe(7);
  });

  it("stays fixed for the whole cycle, so figures don't drift under the narrative", () => {
    const windows = CYCLE.map((day) => reviewWindowFor(weekStartForReviewDay(day, 0)));
    for (const window of windows) {
      expect(window).toEqual(windows[0]);
    }
  });

  it("crosses a month boundary", () => {
    expect(reviewWindowFor("2026-10-04")).toEqual({ start: "2026-09-27", end: "2026-10-03" });
  });
});
