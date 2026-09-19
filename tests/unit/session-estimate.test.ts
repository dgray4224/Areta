import { describe, expect, it } from "vitest";
import { estimateItemMinutes, estimateSessionMinutes } from "@/domains/workoutplan/session-estimate";

const strength = (sets: number, reps: number, restSeconds: number | null = null) => ({
  durationMinutes: null,
  sets,
  reps,
  restSeconds,
});

describe("estimateItemMinutes", () => {
  it("trusts an explicit duration outright, as timed work states its own length", () => {
    expect(estimateItemMinutes({ durationMinutes: 30, sets: 3, reps: 10 })).toBe(30);
  });

  it("builds strength work from sets, reps and the prescribed rest", () => {
    // 3 x 10 at 90s rest: 90s of work, 270s of rest.
    expect(estimateItemMinutes(strength(3, 10, 90))).toBeCloseTo((3 * (10 * 3 + 90)) / 60, 5);
  });

  // The rest after an exercise's last set is the walk to the next one.
  // Dropping it produced 25 minutes for a fifteen-set session.
  it("charges rest after every set, including the last", () => {
    expect(estimateItemMinutes(strength(1, 10, 120))).toBeCloseTo((10 * 3 + 120) / 60, 5);
  });

  it("falls back to a default rest only when the plan does not state one", () => {
    const stated = estimateItemMinutes(strength(3, 10, 120));
    const unstated = estimateItemMinutes(strength(3, 10, null));
    expect(stated).toBeGreaterThan(unstated as number);
  });

  // A set-based item with no reps is usually a hold or a carry; dropping
  // it entirely would understate the session more than counting it once.
  it("still counts a set-based item with no reps", () => {
    expect(estimateItemMinutes(strength(3, 0, 60))).toBeGreaterThan(0);
  });

  it("gives up on an item with nothing to go on", () => {
    expect(estimateItemMinutes({ durationMinutes: null, sets: null, reps: null })).toBeNull();
  });
});

describe("estimateSessionMinutes", () => {
  it("produces a believable length for an ordinary strength session", () => {
    // Five exercises at 3 x 10, 60s rest — a normal full-body day.
    const minutes = estimateSessionMinutes(Array.from({ length: 5 }, () => strength(3, 10, 60)));
    expect(minutes).toBeGreaterThanOrEqual(25);
    expect(minutes).toBeLessThanOrEqual(50);
  });

  it("rounds to five minutes rather than implying precision it lacks", () => {
    const minutes = estimateSessionMinutes([strength(3, 11, 70), strength(4, 7, 55)]);
    expect(minutes! % 5).toBe(0);
  });

  it("adds setup once for the session, not once per exercise", () => {
    const one = estimateSessionMinutes([strength(3, 10, 60)])!;
    const two = estimateSessionMinutes([strength(3, 10, 60), strength(3, 10, 60)])!;
    // Two of the same exercise costs less than twice a single session,
    // because the setup allowance is not paid twice.
    expect(two).toBeLessThan(one * 2);
  });

  it("handles a mixed session of timed and strength work", () => {
    const minutes = estimateSessionMinutes([{ durationMinutes: 20, sets: null, reps: null }, strength(3, 10, 60)]);
    expect(minutes).toBeGreaterThan(20);
  });

  // A wrong number is worse than no number on a card someone uses to
  // decide whether they have time to train.
  it("says nothing when nothing in the session can be estimated", () => {
    expect(estimateSessionMinutes([{ durationMinutes: null, sets: null, reps: null }])).toBeNull();
    expect(estimateSessionMinutes([])).toBeNull();
  });
});
