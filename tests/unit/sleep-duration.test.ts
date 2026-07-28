import { describe, expect, it } from "vitest";
import { computeSleepDurationMinutes } from "@/domains/sleep/duration";

describe("computeSleepDurationMinutes", () => {
  it("computes minutes between bedtime and wake time across midnight", () => {
    const minutes = computeSleepDurationMinutes(
      "2026-01-01T22:30:00",
      "2026-01-02T06:30:00"
    );
    expect(minutes).toBe(8 * 60);
  });

  it("computes minutes within the same day (e.g. a nap)", () => {
    const minutes = computeSleepDurationMinutes(
      "2026-01-01T13:00:00",
      "2026-01-01T13:30:00"
    );
    expect(minutes).toBe(30);
  });
});
