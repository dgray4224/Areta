import { describe, expect, it } from "vitest";
import { recommendServings } from "@/domains/trainermealprogram/portion-recommendation";

describe("recommendServings", () => {
  it("splits the daily target evenly across the day's meal slots", () => {
    // 2000 cal / 4 slots = 500 cal/slot; a 500-cal recipe should land on 1x.
    expect(recommendServings(2000, 4, 500)).toBe(1);
  });

  it("scales up for a lower-calorie recipe to still hit its slot's share", () => {
    // 2000 / 4 = 500 cal/slot; a 250-cal recipe needs 2x to hit that.
    expect(recommendServings(2000, 4, 250)).toBe(2);
  });

  it("scales down for a higher-calorie recipe", () => {
    // 2000 / 4 = 500 cal/slot; a 1000-cal recipe needs 0.5x.
    expect(recommendServings(2000, 4, 1000)).toBe(0.5);
  });

  it("rounds to the nearest quarter serving", () => {
    // 2200 / 4 = 550; 550 / 400 = 1.375 -> rounds to 1.5.
    expect(recommendServings(2200, 4, 400)).toBe(1.5);
  });

  it("fewer meal slots that day means a bigger share per slot", () => {
    // 2000 / 2 = 1000 cal/slot; a 500-cal recipe needs 2x.
    expect(recommendServings(2000, 2, 500)).toBe(2);
  });

  it("clamps to a 0.25 floor rather than recommending a near-zero portion", () => {
    expect(recommendServings(2000, 4, 5000)).toBe(0.25);
  });

  it("clamps to a 4x ceiling rather than recommending an unrealistic portion", () => {
    expect(recommendServings(4000, 1, 100)).toBe(4);
  });

  it("falls back to 1x for missing or invalid inputs rather than dividing by zero", () => {
    expect(recommendServings(0, 4, 500)).toBe(1);
    expect(recommendServings(2000, 0, 500)).toBe(1);
    expect(recommendServings(2000, 4, 0)).toBe(1);
  });
});
