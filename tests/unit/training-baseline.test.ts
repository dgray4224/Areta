import { describe, expect, it } from "vitest";
import { computeTrainingBaseline, describeAgo, type TrainingDay } from "@/domains/review/training-baseline";

const WEEK = "2026-09-20";

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** One week of days, `trainingDays` of them with a 45-minute workout. */
function week(weeksAgo: number, trainingDays: number): TrainingDay[] {
  const start = addDays(WEEK, -7 * weeksAgo);
  return Array.from({ length: 7 }, (_, i) => ({
    date: addDays(start, i),
    workoutMinutes: i < trainingDays ? 45 : 0,
    steps: 5000,
  }));
}

describe("describeAgo", () => {
  it("speaks in weeks, then months", () => {
    expect(describeAgo(1)).toBe("last week");
    expect(describeAgo(5)).toBe("about 5 weeks ago");
    expect(describeAgo(38)).toBe("about 9 months ago");
    expect(describeAgo(60)).toBe("about a year ago");
  });
});

describe("computeTrainingBaseline", () => {
  it("finds the stretch they were strongest and how long ago it ended", () => {
    const days = [
      ...week(0, 3),
      ...week(1, 1), ...week(2, 0), ...week(3, 1), ...week(4, 0), ...week(5, 2), ...week(6, 2), ...week(7, 3),
      ...week(8, 6), ...week(9, 6), ...week(10, 7), ...week(11, 6),
      ...week(12, 4),
    ];
    const b = computeTrainingBaseline(WEEK, days, 7);
    expect(b.thisWeekDays).toBe(3);
    expect(b.bestStretchReachesPlan).toBe(false);
    expect(computeTrainingBaseline(WEEK, days, 6).bestStretchReachesPlan).toBe(true);
    expect(b.last4WeeksAverageDays).toBe(0.5);
    expect(b.bestWeekLast12).toEqual({ days: 7, startDate: addDays(WEEK, -70), weeksAgo: 10 });
    expect(b.thisWeekMatchesOrBeatsLast12).toBe(false);
    expect(b.bestStretch).toEqual({
      averageDaysPerWeek: 6.3,
      fewestDaysInAWeek: 6,
      startDate: addDays(WEEK, -7 * 11),
      endDate: addDays(WEEK, -7 * 8 + 6),
      endedWeeksAgo: 8,
      when: "July 2026 to August 2026, about 2 months ago",
    });
  });

  it("knows when this week is the best in the last 12", () => {
    const b = computeTrainingBaseline(WEEK, [...week(0, 3), ...week(1, 1), ...week(2, 3), ...week(5, 2)]);
    expect(b.bestWeekLast12).toEqual({ days: 3, startDate: addDays(WEEK, -14), weeksAgo: 2 });
    expect(b.thisWeekMatchesOrBeatsLast12).toBe(true);
  });

  // A phone that wasn't recording is not a week off.
  it("leaves weeks with no data out of every average", () => {
    const b = computeTrainingBaseline(WEEK, [...week(0, 2), ...week(1, 4), ...week(3, 4)]);
    expect(b.last4WeeksAverageDays).toBe(4);
    expect(b.weeksOfHistory).toBe(2);
    expect(b.bestStretch).toBeNull();
  });

  it("works for a brand-new account with nothing imported", () => {
    const b = computeTrainingBaseline(WEEK, []);
    expect(b.thisWeekDays).toBe(0);
    expect(b.last4WeeksAverageDays).toBeNull();
    expect(b.bestStretch).toBeNull();
    expect(b.weeksOfHistory).toBe(0);
    expect(b.bestWeekLast12).toBeNull();
    expect(b.thisWeekMatchesOrBeatsLast12).toBe(false);
  });
});
