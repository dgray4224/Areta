import { describe, expect, it } from "vitest";
import type { DaySummary, DetectorInput } from "@/domains/insights/types";
import { addDaysToDateString } from "@/domains/insights/dates";
import { detectSleepNextDayCompletion } from "@/domains/insights/detectors/sleep-next-day-completion";
import { detectWeekdayPattern } from "@/domains/insights/detectors/weekday-pattern";
import { detectWorkoutTimingSleep } from "@/domains/insights/detectors/workout-timing-sleep";
import { detectWeekendShift } from "@/domains/insights/detectors/weekend-shift";
import { detectPersonalRecords } from "@/domains/insights/detectors/personal-record";
import { detectBehaviorStreaks } from "@/domains/insights/detectors/behavior-streak";
import { computeTaskCompletions } from "@/domains/insights/service";

const TODAY = "2026-08-14";

function emptyDay(day: string): DaySummary {
  return {
    day,
    dayOfWeek: new Date(`${day}T00:00:00Z`).getUTCDay(),
    isWeekend: [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()),
    stepsTotal: 0,
    stepsMostActiveLocalHour: null,
    sleepTotalDurationMinutes: null,
    workoutCount: 0,
    workoutTotalMinutes: 0,
    workoutFirstStartLocalHour: null,
  };
}

/** `count` consecutive days ending at TODAY, oldest first, customized per
 * index (0 = oldest). */
function daysEndingToday(count: number, customize: (day: DaySummary, index: number) => void): DaySummary[] {
  const days: DaySummary[] = [];
  for (let i = 0; i < count; i++) {
    const day = emptyDay(addDaysToDateString(TODAY, -(count - 1 - i)));
    customize(day, i);
    days.push(day);
  }
  return days;
}

function baseInput(overrides: Partial<DetectorInput> = {}): DetectorInput {
  return {
    summaries: [],
    taskCompletions: [],
    allTimeSummaries: [],
    today: TODAY,
    seedKey: "test-user",
    ...overrides,
  };
}

describe("detectSleepNextDayCompletion", () => {
  const summaries = daysEndingToday(60, (day, i) => {
    day.sleepTotalDurationMinutes = i % 2 === 0 ? 360 : 480;
  });

  it("fires when good nights predict better next-day completion", () => {
    // Completion on day D+1 tracks day D's sleep: ~85% after 480min
    // nights, ~60% after 360min nights (small deterministic noise).
    const taskCompletions = summaries.slice(0, -1).map((s, i) => ({
      day: addDaysToDateString(s.day, 1),
      totalTasks: 5,
      completionPercent: (s.sleepTotalDurationMinutes === 480 ? 85 : 60) + (i % 3),
    }));
    const results = detectSleepNextDayCompletion(baseInput({ summaries, taskCompletions }));
    expect(results).toHaveLength(1);
    expect(results[0].facts.goodAvgCompletion).toBeGreaterThan(Number(results[0].facts.shortAvgCompletion));
    expect(Number(results[0].facts.pValue)).toBeLessThan(0.05);
  });

  it("stays silent when completion is unrelated to sleep", () => {
    const taskCompletions = summaries.slice(0, -1).map((s, i) => ({
      day: addDaysToDateString(s.day, 1),
      totalTasks: 5,
      completionPercent: 70 + (i % 5),
    }));
    expect(detectSleepNextDayCompletion(baseInput({ summaries, taskCompletions }))).toHaveLength(0);
  });

  it("stays silent below the minimum paired days", () => {
    const few = summaries.slice(0, 20);
    const taskCompletions = few.map((s) => ({
      day: addDaysToDateString(s.day, 1),
      totalTasks: 5,
      completionPercent: s.sleepTotalDurationMinutes === 480 ? 90 : 40,
    }));
    expect(detectSleepNextDayCompletion(baseInput({ summaries: few, taskCompletions }))).toHaveLength(0);
  });
});

describe("detectWeekdayPattern", () => {
  it("finds the bad weekday", () => {
    const days = daysEndingToday(56, () => {});
    const taskCompletions = days.map((d, i) => ({
      day: d.day,
      totalTasks: 4,
      completionPercent: d.dayOfWeek === 2 ? 40 + (i % 3) : 80 + (i % 3),
    }));
    const results = detectWeekdayPattern(baseInput({ taskCompletions }));
    expect(results).toHaveLength(1);
    expect(results[0].facts.dayOfWeek).toBe(2);
    expect(results[0].facts.direction).toBe("worse");
  });

  it("stays silent when every weekday looks the same", () => {
    const days = daysEndingToday(56, () => {});
    const taskCompletions = days.map((d, i) => ({
      day: d.day,
      totalTasks: 4,
      completionPercent: 75 + (i % 7),
    }));
    expect(detectWeekdayPattern(baseInput({ taskCompletions }))).toHaveLength(0);
  });
});

describe("detectWorkoutTimingSleep", () => {
  it("fires on a clear morning-vs-evening sleep difference", () => {
    const summaries = daysEndingToday(40, (day, i) => {
      if (i < 12) {
        day.workoutCount = 1;
        day.workoutFirstStartLocalHour = 7;
        day.sleepTotalDurationMinutes = 470 + (i % 3) * 10;
      } else if (i < 24) {
        day.workoutCount = 1;
        day.workoutFirstStartLocalHour = 19;
        day.sleepTotalDurationMinutes = 400 + (i % 3) * 10;
      }
    });
    const results = detectWorkoutTimingSleep(baseInput({ summaries }));
    expect(results).toHaveLength(1);
    expect(results[0].facts.betterBucket).toBe("morning");
    expect(Number(results[0].facts.effectMinutes)).toBeGreaterThanOrEqual(20);
  });

  it("stays silent with too few days in a bucket", () => {
    const summaries = daysEndingToday(40, (day, i) => {
      if (i < 3) {
        day.workoutCount = 1;
        day.workoutFirstStartLocalHour = 7;
        day.sleepTotalDurationMinutes = 480;
      } else if (i < 20) {
        day.workoutCount = 1;
        day.workoutFirstStartLocalHour = 19;
        day.sleepTotalDurationMinutes = 400;
      }
    });
    expect(detectWorkoutTimingSleep(baseInput({ summaries }))).toHaveLength(0);
  });
});

describe("detectWeekendShift", () => {
  it("fires on a weekend sleep shift and reports at most one insight", () => {
    const summaries = daysEndingToday(90, (day, i) => {
      day.sleepTotalDurationMinutes = (day.isWeekend ? 480 : 400) + (i % 2) * 10;
    });
    const results = detectWeekendShift(baseInput({ summaries }));
    expect(results).toHaveLength(1);
    expect(results[0].facts.metric).toBe("sleep");
    expect(Number(results[0].facts.effect)).toBeGreaterThanOrEqual(30);
  });

  it("stays silent when weekends match weekdays", () => {
    const summaries = daysEndingToday(90, (day, i) => {
      day.sleepTotalDurationMinutes = 430 + (i % 2) * 10;
      day.stepsTotal = 8000 + (i % 5) * 100;
    });
    expect(detectWeekendShift(baseInput({ summaries }))).toHaveLength(0);
  });
});

describe("detectPersonalRecords", () => {
  it("fires a fresh step-day record and a workout milestone", () => {
    const allTime = daysEndingToday(40, (day, i) => {
      day.stepsTotal = i === 38 ? 12000 : 5000 + (i % 7) * 100; // record yesterday
      day.workoutCount = 1; // 40 total -> crosses the 25 milestone
    }).map((d) => ({ day: d.day, stepsTotal: d.stepsTotal, workoutCount: d.workoutCount, workoutTotalMinutes: d.workoutTotalMinutes }));
    const results = detectPersonalRecords(baseInput({ allTimeSummaries: allTime }));
    const kinds = results.map((r) => r.facts.kind);
    expect(kinds).toContain("steps_day");
    expect(kinds).toContain("workout_milestone");
    const milestone = results.find((r) => r.facts.kind === "workout_milestone");
    expect(milestone?.facts.milestone).toBe(25);
  });

  it("does not fire a stale record", () => {
    const allTime = daysEndingToday(40, (day, i) => {
      day.stepsTotal = i === 20 ? 12000 : 5000 + (i % 7) * 100; // record 19 days ago
    }).map((d) => ({ day: d.day, stepsTotal: d.stepsTotal, workoutCount: 0, workoutTotalMinutes: 0 }));
    const results = detectPersonalRecords(baseInput({ allTimeSummaries: allTime }));
    expect(results.map((r) => r.facts.kind)).not.toContain("steps_day");
  });

  it("requires enough history before declaring a record", () => {
    const allTime = daysEndingToday(10, (day, i) => {
      day.stepsTotal = i === 9 ? 12000 : 5000;
    }).map((d) => ({ day: d.day, stepsTotal: d.stepsTotal, workoutCount: 0, workoutTotalMinutes: 0 }));
    expect(detectPersonalRecords(baseInput({ allTimeSummaries: allTime }))).toHaveLength(0);
  });
});

describe("detectBehaviorStreaks", () => {
  it("fires the 7-day steps milestone for a live streak", () => {
    const summaries = daysEndingToday(30, (day, i) => {
      if (i < 22) day.stepsTotal = 6000;
      else if (i === 22) day.stepsTotal = 1000; // breaks anything longer
      else day.stepsTotal = 9000; // last 7 days above the 6000 median
    });
    const results = detectBehaviorStreaks(baseInput({ summaries }));
    const steps = results.find((r) => r.facts.kind === "steps_above_median");
    expect(steps).toBeDefined();
    expect(steps?.facts.length).toBe(7);
    expect(steps?.facts.currentStreak).toBe(7);
  });

  it("fires the consecutive-workout-weeks milestone", () => {
    const summaries = daysEndingToday(28, (day, i) => {
      // Last 3 rolling weeks have 2 workout days each; the oldest has none.
      const weekFromEnd = Math.floor((27 - i) / 7);
      if (weekFromEnd < 3 && i % 7 < 2) {
        day.workoutCount = 1;
      }
    });
    const results = detectBehaviorStreaks(baseInput({ summaries }));
    const weeks = results.find((r) => r.facts.kind === "workout_weeks");
    expect(weeks).toBeDefined();
    expect(weeks?.facts.length).toBe(3);
  });

  it("stays silent below every milestone", () => {
    const summaries = daysEndingToday(30, (day, i) => {
      day.stepsTotal = i >= 27 ? 9000 : i % 2 === 0 ? 6000 : 3000; // 3-day streak only
    });
    const results = detectBehaviorStreaks(baseInput({ summaries }));
    expect(results.find((r) => r.facts.kind === "steps_above_median")).toBeUndefined();
  });
});

describe("computeTaskCompletions", () => {
  it("buckets by day and rounds the completion percent", () => {
    const result = computeTaskCompletions([
      { date: "2026-08-10", status: "completed" },
      { date: "2026-08-10", status: "skipped" },
      { date: "2026-08-10", status: "partially_completed" },
      { date: "2026-08-11", status: "pending" },
    ]);
    expect(result).toEqual([
      { day: "2026-08-10", totalTasks: 3, completionPercent: 67 },
      { day: "2026-08-11", totalTasks: 1, completionPercent: 0 },
    ]);
  });
});
