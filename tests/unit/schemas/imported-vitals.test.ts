import { describe, expect, it } from "vitest";
import { importedVitalSampleSchema, importedMindfulSessionSchema } from "@/domains/vitals/schema";

describe("importedVitalSampleSchema", () => {
  const valid = {
    loggedAt: "2026-01-05T08:00:00.000Z",
    value: 47.2,
    unit: "ml/(kg*min)",
    source: "healthkit",
    device: "Apple Watch",
    dedupKey: "healthkit-sample-vo2max-abc123",
  };

  it("accepts a fully-formed imported record", () => {
    expect(importedVitalSampleSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a missing device (optional)", () => {
    expect(importedVitalSampleSchema.safeParse({ ...valid, device: undefined }).success).toBe(true);
  });

  it("rejects a missing dedupKey — imported records must be deduplicable", () => {
    expect(importedVitalSampleSchema.safeParse({ ...valid, dedupKey: undefined }).success).toBe(false);
  });

  it("rejects a missing unit", () => {
    expect(importedVitalSampleSchema.safeParse({ ...valid, unit: undefined }).success).toBe(false);
  });
});

describe("importedMindfulSessionSchema", () => {
  const valid = {
    startDate: "2026-01-05T08:00:00.000Z",
    endDate: "2026-01-05T08:10:00.000Z",
    source: "healthkit",
    device: "iPhone",
    dedupKey: "healthkit-sample-mindful-xyz789",
  };

  it("accepts a fully-formed imported record", () => {
    expect(importedMindfulSessionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing endDate", () => {
    expect(importedMindfulSessionSchema.safeParse({ ...valid, endDate: undefined }).success).toBe(false);
  });

  it("rejects a missing dedupKey", () => {
    expect(importedMindfulSessionSchema.safeParse({ ...valid, dedupKey: undefined }).success).toBe(false);
  });
});
