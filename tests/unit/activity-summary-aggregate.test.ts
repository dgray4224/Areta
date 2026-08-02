import { describe, expect, it } from "vitest";
import { aggregateActivityDailySummary } from "@/domains/activity-summary/aggregate";

const baseInput = {
  userId: "user-1",
  day: "2026-08-02",
  timezone: "America/Los_Angeles",
  workoutLogs: [],
  weightLogs: [],
  stepLogs: [],
  sleepLogs: [],
  heartRateLogs: [],
};

describe("aggregateActivityDailySummary", () => {
  it("returns an all-empty row when there are no logs", () => {
    const result = aggregateActivityDailySummary(baseInput);
    expect(result.workout_count).toBe(0);
    expect(result.weight_logged).toBe(false);
    expect(result.steps_total).toBe(0);
    expect(result.sleep_logged).toBe(false);
    expect(result.heart_rate_avg_bpm).toBeNull();
  });

  it("picks first/last weight value in chronological order regardless of input order", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      weightLogs: [
        { logged_at: "2026-08-02T20:00:00Z", weight: 180, unit: "lb" },
        { logged_at: "2026-08-02T14:00:00Z", weight: 182, unit: "lb" },
      ],
    });
    expect(result.weight_first_value).toBe(182);
    expect(result.weight_last_value).toBe(180);
  });

  it("sums workout counts/minutes and picks first/last start times", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      workoutLogs: [
        { start_date: "2026-08-02T22:00:00Z", duration_minutes: 30, activity_type: "Weightlifting" },
        { start_date: "2026-08-02T14:00:00Z", duration_minutes: 45, activity_type: "Running" },
      ],
    });
    expect(result.workout_count).toBe(2);
    expect(result.workout_total_minutes).toBe(75);
    expect(result.workout_first_start_at).toBe("2026-08-02T14:00:00.000Z");
    expect(result.workout_last_start_at).toBe("2026-08-02T22:00:00.000Z");
    // 14:00 UTC is 7am Pacific in August.
    expect(result.workout_first_start_local_hour).toBe(7);
  });

  it("returns distinct workout activity types in chronological first-occurrence order", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      workoutLogs: [
        { start_date: "2026-08-02T22:00:00Z", duration_minutes: 30, activity_type: "Weightlifting" },
        { start_date: "2026-08-02T14:00:00Z", duration_minutes: 45, activity_type: "Running" },
      ],
    });
    expect(result.workout_activity_types).toEqual(["Running", "Weightlifting"]);
  });

  it("de-dupes repeated activity types on the same day", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      workoutLogs: [
        { start_date: "2026-08-02T14:00:00Z", duration_minutes: 30, activity_type: "Running" },
        { start_date: "2026-08-02T22:00:00Z", duration_minutes: 25, activity_type: "Running" },
      ],
    });
    expect(result.workout_count).toBe(2);
    expect(result.workout_activity_types).toEqual(["Running"]);
  });

  it("picks the hour with the most total steps", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      stepLogs: [
        { logged_at: "2026-08-02T15:00:00Z", count: 500 }, // 8am Pacific
        { logged_at: "2026-08-02T15:30:00Z", count: 200 }, // same hour
        { logged_at: "2026-08-03T01:00:00Z", count: 100 }, // 6pm Pacific
      ],
    });
    expect(result.steps_total).toBe(800);
    expect(result.steps_most_active_local_hour).toBe(8);
  });

  it("sums sleep duration but averages (rounded) quality across multiple entries", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      sleepLogs: [
        { total_duration_minutes: 400, quality: 4 },
        { total_duration_minutes: 30, quality: 3 },
      ],
    });
    expect(result.sleep_logged).toBe(true);
    expect(result.sleep_total_duration_minutes).toBe(430);
    expect(result.sleep_quality).toBe(4); // round(3.5) === 4
  });

  it("averages heart rate across samples", () => {
    const result = aggregateActivityDailySummary({
      ...baseInput,
      heartRateLogs: [{ bpm: 60 }, { bpm: 80 }],
    });
    expect(result.heart_rate_avg_bpm).toBe(70);
    expect(result.heart_rate_sample_count).toBe(2);
  });
});
