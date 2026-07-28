import { describe, expect, it } from "vitest";
import { weightLogSchema } from "@/domains/weight/schema";
import { sleepLogSchema } from "@/domains/sleep/schema";
import { nutritionLogSchema } from "@/domains/nutrition/log-schema";
import { recoveryLogSchema } from "@/domains/recovery/log-schema";
import { studySessionSchema } from "@/domains/learning/log-schema";
import { createTaskSchema, updateTaskStatusSchema } from "@/domains/tasks/schema";

describe("weightLogSchema", () => {
  it("accepts a minimal valid entry", () => {
    expect(
      weightLogSchema.safeParse({ loggedAt: "2026-01-01T08:00", weight: 200, unit: "lb" }).success
    ).toBe(true);
  });

  it("rejects a non-positive weight", () => {
    expect(
      weightLogSchema.safeParse({ loggedAt: "2026-01-01T08:00", weight: 0, unit: "lb" }).success
    ).toBe(false);
  });

  it("rejects an unknown unit", () => {
    expect(
      weightLogSchema.safeParse({ loggedAt: "2026-01-01T08:00", weight: 200, unit: "stone" })
        .success
    ).toBe(false);
  });
});

describe("sleepLogSchema", () => {
  it("accepts a date-only entry (everything else optional)", () => {
    expect(sleepLogSchema.safeParse({ date: "2026-01-01" }).success).toBe(true);
  });

  it("rejects quality outside 1-5", () => {
    expect(sleepLogSchema.safeParse({ date: "2026-01-01", quality: 6 }).success).toBe(false);
  });
});

describe("nutritionLogSchema", () => {
  it("accepts a minimal valid entry", () => {
    expect(
      nutritionLogSchema.safeParse({ date: "2026-01-01", meal: "breakfast", food: "Eggs" }).success
    ).toBe(true);
  });

  it("rejects an unknown meal type", () => {
    expect(
      nutritionLogSchema.safeParse({ date: "2026-01-01", meal: "brunch", food: "Eggs" }).success
    ).toBe(false);
  });

  it("rejects an empty food description", () => {
    expect(
      nutritionLogSchema.safeParse({ date: "2026-01-01", meal: "breakfast", food: "" }).success
    ).toBe(false);
  });
});

describe("recoveryLogSchema", () => {
  it("accepts a minimal entry with warningSigns explicitly false", () => {
    expect(recoveryLogSchema.safeParse({ date: "2026-01-01", warningSigns: false }).success).toBe(
      true
    );
  });

  it("rejects pain outside 0-10", () => {
    expect(
      recoveryLogSchema.safeParse({ date: "2026-01-01", warningSigns: false, pain: 11 }).success
    ).toBe(false);
  });
});

describe("studySessionSchema", () => {
  it("accepts a minimal valid entry", () => {
    expect(
      studySessionSchema.safeParse({ date: "2026-01-01", task: "Read chapter 3" }).success
    ).toBe(true);
  });

  it("rejects an empty task description", () => {
    expect(studySessionSchema.safeParse({ date: "2026-01-01", task: "" }).success).toBe(false);
  });
});

describe("createTaskSchema", () => {
  it("accepts a minimal valid task", () => {
    expect(
      createTaskSchema.safeParse({ date: "2026-01-01", title: "Take a walk", isRequired: true })
        .success
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      createTaskSchema.safeParse({ date: "2026-01-01", title: "", isRequired: true }).success
    ).toBe(false);
  });
});

describe("updateTaskStatusSchema", () => {
  it("accepts a valid status transition", () => {
    expect(
      updateTaskStatusSchema.safeParse({ taskId: "abc", status: "completed" }).success
    ).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      updateTaskStatusSchema.safeParse({ taskId: "abc", status: "abandoned" }).success
    ).toBe(false);
  });
});
