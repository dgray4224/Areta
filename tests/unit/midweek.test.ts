import { describe, expect, it } from "vitest";
import { midweekCheck, type MidweekInput } from "@/domains/review/midweek";

const WEDNESDAY = 3;
const FRIDAY = 5;

function input(overrides: Partial<MidweekInput> = {}): MidweekInput {
  return {
    dayOfWeek: WEDNESDAY,
    plannedTrainingDays: [],
    unplannedTrainingDays: 0,
    mealsPlannedSoFar: 0,
    mealsSkippedSoFar: 0,
    ...overrides,
  };
}

const day = (done: boolean, inPast: boolean) => ({ done, inPast });

describe("midweekCheck: when it speaks at all", () => {
  // Something that speaks every week stops being read, so a week going
  // roughly to plan hears nothing.
  it("says nothing when the week is on track", () => {
    expect(
      midweekCheck(input({ plannedTrainingDays: [day(true, true), day(true, true), day(false, false)] }))
    ).toBeNull();
  });

  it("says nothing about a single missed session", () => {
    expect(
      midweekCheck(input({ plannedTrainingDays: [day(false, true), day(false, false), day(false, false)] }))
    ).toBeNull();
  });

  it("stays quiet before Wednesday, when there is no evidence yet", () => {
    for (const dayOfWeek of [0, 1, 2]) {
      expect(
        midweekCheck(input({ dayOfWeek, plannedTrainingDays: [day(false, true), day(false, true), day(false, false)] }))
      ).toBeNull();
    }
  });

  it("stays quiet after Friday, when there is no time to act", () => {
    for (const dayOfWeek of [6]) {
      expect(
        midweekCheck(input({ dayOfWeek, plannedTrainingDays: [day(false, true), day(false, true), day(false, false)] }))
      ).toBeNull();
    }
  });
});

describe("midweekCheck: what it says", () => {
  it("blames the plan, not the person, when training is happening off plan", () => {
    const signal = midweekCheck(
      input({
        plannedTrainingDays: [day(false, true), day(false, true), day(false, false)],
        unplannedTrainingDays: 2,
      })
    );
    expect(signal?.kind).toBe("training_off_plan");
    expect(signal?.detail).toContain("moving your training days");
  });

  it("prefers the off-plan reading over simply being behind", () => {
    const behindAndOffPlan = input({
      plannedTrainingDays: [day(false, true), day(false, true), day(false, false)],
      unplannedTrainingDays: 3,
    });
    expect(midweekCheck(behindAndOffPlan)?.kind).toBe("training_off_plan");
  });

  it("reports being behind while sessions remain", () => {
    const signal = midweekCheck(
      input({ plannedTrainingDays: [day(false, true), day(false, true), day(false, false), day(false, false)] })
    );
    expect(signal?.kind).toBe("behind_on_training");
    expect(signal?.headline).toContain("2 sessions missed");
    expect(signal?.detail).toContain("still room");
  });

  it("does not pretend a week is recoverable when it is not", () => {
    const signal = midweekCheck(
      input({
        dayOfWeek: FRIDAY,
        plannedTrainingDays: [day(false, true), day(false, true), day(false, true), day(false, false)],
      })
    );
    expect(signal?.detail).toContain("Not all of it is recoverable");
  });

  it("says nothing about being behind once no sessions remain", () => {
    expect(
      midweekCheck(input({ dayOfWeek: FRIDAY, plannedTrainingDays: [day(false, true), day(false, true)] }))
    ).toBeNull();
  });

  it("reads repeated meal refusals as the plan not fitting", () => {
    const signal = midweekCheck(input({ mealsPlannedSoFar: 6, mealsSkippedSoFar: 4 }));
    expect(signal?.kind).toBe("meals_not_fitting");
    expect(signal?.detail).toContain("4 of 6");
  });

  it("ignores a couple of refused meals in a well-followed week", () => {
    expect(midweekCheck(input({ mealsPlannedSoFar: 12, mealsSkippedSoFar: 2 }))).toBeNull();
  });

  it("returns one signal, never a list", () => {
    const signal = midweekCheck(
      input({
        plannedTrainingDays: [day(false, true), day(false, true), day(false, false)],
        unplannedTrainingDays: 2,
        mealsPlannedSoFar: 6,
        mealsSkippedSoFar: 5,
      })
    );
    expect(signal).not.toBeNull();
    expect(Array.isArray(signal)).toBe(false);
    expect(signal?.kind).toBe("training_off_plan");
  });
});
