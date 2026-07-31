import { describe, expect, it } from "vitest";
import { importedWeightLogSchema } from "@/domains/weight/schema";
import { importedSleepLogSchema } from "@/domains/sleep/schema";

describe("importedWeightLogSchema", () => {
  const valid = {
    loggedAt: "2026-01-05T08:00:00.000Z",
    weight: 198.4,
    unit: "lb" as const,
    source: "healthkit",
    device: "Apple Watch",
    dedupKey: "healthkit-sample-abc123",
  };

  it("accepts a fully-formed imported record", () => {
    expect(importedWeightLogSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a missing device (optional)", () => {
    expect(importedWeightLogSchema.safeParse({ ...valid, device: undefined }).success).toBe(true);
  });

  it("rejects a missing dedupKey — imported records must be deduplicable", () => {
    expect(importedWeightLogSchema.safeParse({ ...valid, dedupKey: undefined }).success).toBe(false);
  });

  it("rejects a missing source", () => {
    expect(importedWeightLogSchema.safeParse({ ...valid, source: undefined }).success).toBe(false);
  });

  it("rejects a non-positive weight", () => {
    expect(importedWeightLogSchema.safeParse({ ...valid, weight: 0 }).success).toBe(false);
  });

  it("rejects an invalid unit", () => {
    expect(importedWeightLogSchema.safeParse({ ...valid, unit: "stone" }).success).toBe(false);
  });
});

describe("importedSleepLogSchema", () => {
  const valid = {
    date: "2026-01-05",
    bedtime: "2026-01-04T23:00:00.000Z",
    wakeTime: "2026-01-05T07:00:00.000Z",
    source: "healthkit",
    device: "Apple Watch",
    dedupKey: "healthkit-sample-xyz789",
  };

  it("accepts a fully-formed imported record", () => {
    expect(importedSleepLogSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an explicit totalDurationMinutes instead of bedtime/wakeTime", () => {
    const result = importedSleepLogSchema.safeParse({
      ...valid,
      bedtime: undefined,
      wakeTime: undefined,
      totalDurationMinutes: 420,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing dedupKey", () => {
    expect(importedSleepLogSchema.safeParse({ ...valid, dedupKey: undefined }).success).toBe(false);
  });

  it("rejects a negative interruptions count", () => {
    expect(importedSleepLogSchema.safeParse({ ...valid, interruptions: -1 }).success).toBe(false);
  });

  it("rejects a quality rating outside 1-5", () => {
    expect(importedSleepLogSchema.safeParse({ ...valid, quality: 6 }).success).toBe(false);
  });
});
