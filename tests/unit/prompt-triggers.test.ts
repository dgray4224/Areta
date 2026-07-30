import { describe, expect, it } from "vitest";
import { PROMPT_TRIGGERS, type TriggerInput } from "@/domains/prompts/triggers";

function trigger(id: string) {
  const t = PROMPT_TRIGGERS.find((t) => t.id === id);
  if (!t) throw new Error(`Missing trigger: ${id}`);
  return t;
}

const baseInput: TriggerInput = {
  today: "2026-07-28",
  activeGoals: [],
  activeDomains: [],
  hasRecentExerciseLog: true,
  recentSleepDurationsMinutes: [],
  skippedRequiredTaskCountByDomain: {},
};

describe("exercise_goal_stalled", () => {
  const t = trigger("exercise_goal_stalled");

  it("fires when an active exercise goal has no recent exercise log", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeGoals: [{ domainKey: "exercise", targetDate: null }],
      hasRecentExerciseLog: false,
    };
    expect(t.evaluate(input)).not.toBeNull();
  });

  it("doesn't fire when the exercise goal has a recent log", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeGoals: [{ domainKey: "exercise", targetDate: null }],
      hasRecentExerciseLog: true,
    };
    expect(t.evaluate(input)).toBeNull();
  });

  it("doesn't fire without an exercise-domain goal", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeGoals: [{ domainKey: "nutrition", targetDate: null }],
      hasRecentExerciseLog: false,
    };
    expect(t.evaluate(input)).toBeNull();
  });
});

describe("goal_target_passed", () => {
  const t = trigger("goal_target_passed");

  it("fires when a goal's target date is in the past", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeGoals: [{ domainKey: "nutrition", targetDate: "2020-01-01" }],
    };
    expect(t.evaluate(input)).not.toBeNull();
  });

  it("doesn't fire when the target date is in the future", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeGoals: [{ domainKey: "nutrition", targetDate: "2099-01-01" }],
    };
    expect(t.evaluate(input)).toBeNull();
  });

  it("doesn't fire without a target date", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeGoals: [{ domainKey: "nutrition", targetDate: null }],
    };
    expect(t.evaluate(input)).toBeNull();
  });
});

describe("sleep_below_norm", () => {
  const t = trigger("sleep_below_norm");

  it("fires when sleep is active and the recent average is under the floor", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeDomains: ["sleep"],
      recentSleepDurationsMinutes: [300, 290, 310],
    };
    expect(t.evaluate(input)).not.toBeNull();
  });

  it("doesn't fire when the recent average is at or above the floor", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeDomains: ["sleep"],
      recentSleepDurationsMinutes: [420, 410, 430],
    };
    expect(t.evaluate(input)).toBeNull();
  });

  it("doesn't fire when sleep isn't an active domain", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeDomains: [],
      recentSleepDurationsMinutes: [300, 290, 310],
    };
    expect(t.evaluate(input)).toBeNull();
  });

  it("doesn't fire with too few logged nights to trust an average", () => {
    const input: TriggerInput = {
      ...baseInput,
      activeDomains: ["sleep"],
      recentSleepDurationsMinutes: [300],
    };
    expect(t.evaluate(input)).toBeNull();
  });
});

describe("missed_tasks_pattern", () => {
  const t = trigger("missed_tasks_pattern");

  it("fires when a domain has 3+ skipped required tasks in the window", () => {
    const input: TriggerInput = {
      ...baseInput,
      skippedRequiredTaskCountByDomain: { nutrition: 3 },
    };
    const question = t.evaluate(input);
    expect(question).not.toBeNull();
    expect(question).toContain("Nutrition");
  });

  it("doesn't fire below the threshold", () => {
    const input: TriggerInput = {
      ...baseInput,
      skippedRequiredTaskCountByDomain: { nutrition: 2 },
    };
    expect(t.evaluate(input)).toBeNull();
  });
});
