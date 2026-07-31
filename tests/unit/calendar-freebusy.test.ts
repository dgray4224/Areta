import { describe, expect, it } from "vitest";
import {
  mergeBusyBlocks,
  computeOpenWindows,
  tagDayPart,
  buildDailyAvailability,
} from "@/domains/calendar/freebusy";

describe("mergeBusyBlocks", () => {
  it("returns an empty array for no input", () => {
    expect(mergeBusyBlocks([])).toEqual([]);
  });

  it("leaves non-overlapping blocks untouched", () => {
    const blocks = [
      { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T10:00:00.000Z" },
      { start: "2026-01-01T14:00:00.000Z", end: "2026-01-01T15:00:00.000Z" },
    ];
    expect(mergeBusyBlocks(blocks)).toEqual(blocks);
  });

  it("coalesces overlapping blocks", () => {
    const merged = mergeBusyBlocks([
      { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T10:30:00.000Z" },
      { start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T11:00:00.000Z" },
    ]);
    expect(merged).toEqual([{ start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T11:00:00.000Z" }]);
  });

  it("coalesces adjacent (touching) blocks", () => {
    const merged = mergeBusyBlocks([
      { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T10:00:00.000Z" },
      { start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T11:00:00.000Z" },
    ]);
    expect(merged).toEqual([{ start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T11:00:00.000Z" }]);
  });

  it("sorts unordered input before merging", () => {
    const merged = mergeBusyBlocks([
      { start: "2026-01-01T14:00:00.000Z", end: "2026-01-01T15:00:00.000Z" },
      { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T10:00:00.000Z" },
    ]);
    expect(merged[0].start).toBe("2026-01-01T09:00:00.000Z");
    expect(merged[1].start).toBe("2026-01-01T14:00:00.000Z");
  });

  it("a block fully contained in another disappears into it", () => {
    const merged = mergeBusyBlocks([
      { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T17:00:00.000Z" },
      { start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T11:00:00.000Z" },
    ]);
    expect(merged).toEqual([{ start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T17:00:00.000Z" }]);
  });
});

describe("computeOpenWindows", () => {
  const dayWindow = { start: "2026-01-01T07:00:00.000Z", end: "2026-01-01T22:00:00.000Z" };

  it("returns the whole window when there's no busy time", () => {
    expect(computeOpenWindows([], dayWindow, 30)).toEqual([dayWindow]);
  });

  it("returns nothing when a single block spans the entire window", () => {
    expect(
      computeOpenWindows(
        [{ start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" }],
        dayWindow,
        30
      )
    ).toEqual([]);
  });

  it("splits the window around a single busy block", () => {
    const open = computeOpenWindows(
      [{ start: "2026-01-01T12:00:00.000Z", end: "2026-01-01T13:00:00.000Z" }],
      dayWindow,
      30
    );
    expect(open).toEqual([
      { start: "2026-01-01T07:00:00.000Z", end: "2026-01-01T12:00:00.000Z" },
      { start: "2026-01-01T13:00:00.000Z", end: "2026-01-01T22:00:00.000Z" },
    ]);
  });

  it("produces multiple gaps for multiple non-overlapping busy blocks", () => {
    const open = computeOpenWindows(
      [
        { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T10:00:00.000Z" },
        { start: "2026-01-01T14:00:00.000Z", end: "2026-01-01T15:00:00.000Z" },
      ],
      dayWindow,
      30
    );
    expect(open).toHaveLength(3);
    expect(open[0]).toEqual({ start: "2026-01-01T07:00:00.000Z", end: "2026-01-01T09:00:00.000Z" });
    expect(open[1]).toEqual({ start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T14:00:00.000Z" });
    expect(open[2]).toEqual({ start: "2026-01-01T15:00:00.000Z", end: "2026-01-01T22:00:00.000Z" });
  });

  it("drops gaps shorter than the minimum duration", () => {
    const open = computeOpenWindows(
      [
        { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T09:50:00.000Z" },
        { start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T22:00:00.000Z" },
      ],
      dayWindow,
      30
    );
    // The 09:50-10:00 gap (10 min) is below the 30-min floor and dropped;
    // the 07:00-09:00 gap (2h) survives.
    expect(open).toEqual([{ start: "2026-01-01T07:00:00.000Z", end: "2026-01-01T09:00:00.000Z" }]);
  });

  it("ignores busy blocks entirely outside the day window", () => {
    const open = computeOpenWindows(
      [{ start: "2026-01-02T09:00:00.000Z", end: "2026-01-02T10:00:00.000Z" }],
      dayWindow,
      30
    );
    expect(open).toEqual([dayWindow]);
  });

  it("clamps a busy block that partially overlaps the window boundary", () => {
    const open = computeOpenWindows(
      [{ start: "2026-01-01T21:00:00.000Z", end: "2026-01-02T02:00:00.000Z" }],
      dayWindow,
      30
    );
    expect(open).toEqual([{ start: "2026-01-01T07:00:00.000Z", end: "2026-01-01T21:00:00.000Z" }]);
  });
});

describe("tagDayPart", () => {
  it("tags before 12:00 UTC as morning", () => {
    expect(tagDayPart("2026-01-01T07:00:00.000Z")).toBe("morning");
    expect(tagDayPart("2026-01-01T11:59:00.000Z")).toBe("morning");
  });

  it("tags 12:00-16:59 UTC as afternoon", () => {
    expect(tagDayPart("2026-01-01T12:00:00.000Z")).toBe("afternoon");
    expect(tagDayPart("2026-01-01T16:59:00.000Z")).toBe("afternoon");
  });

  it("tags 17:00 and later UTC as evening", () => {
    expect(tagDayPart("2026-01-01T17:00:00.000Z")).toBe("evening");
    expect(tagDayPart("2026-01-01T21:00:00.000Z")).toBe("evening");
  });
});

describe("buildDailyAvailability", () => {
  it("returns the full day window per day when there are no events", () => {
    const result = buildDailyAvailability(
      [],
      [{ date: "2026-01-01", wakeTime: "07:00", bedTime: "22:00" }]
    );
    expect(result).toEqual([
      {
        date: "2026-01-01",
        start: "2026-01-01T07:00:00.000Z",
        end: "2026-01-01T22:00:00.000Z",
        durationMinutes: 900,
        dayPart: "morning",
      },
    ]);
  });

  it("only applies each day's events within that day's window", () => {
    const result = buildDailyAvailability(
      [
        { start: "2026-01-01T09:00:00.000Z", end: "2026-01-01T22:00:00.000Z" },
        { start: "2026-01-02T09:00:00.000Z", end: "2026-01-02T10:00:00.000Z" },
      ],
      [
        { date: "2026-01-01", wakeTime: "07:00", bedTime: "22:00" },
        { date: "2026-01-02", wakeTime: "07:00", bedTime: "22:00" },
      ]
    );
    // Day 1: busy 09:00-22:00 leaves only 07:00-09:00 open.
    // Day 2: busy 09:00-10:00 leaves 07:00-09:00 and 10:00-22:00 open.
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ date: "2026-01-01", start: "2026-01-01T07:00:00.000Z" });
    expect(result.filter((w) => w.date === "2026-01-02")).toHaveLength(2);
  });

  it("returns results sorted chronologically across days", () => {
    const result = buildDailyAvailability(
      [],
      [
        { date: "2026-01-02", wakeTime: "07:00", bedTime: "08:00" },
        { date: "2026-01-01", wakeTime: "07:00", bedTime: "08:00" },
      ]
    );
    expect(result[0].date).toBe("2026-01-01");
    expect(result[1].date).toBe("2026-01-02");
  });
});
