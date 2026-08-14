import { describe, expect, it } from "vitest";
import { createSeededRandom, hashSeed, mean, median, permutationPValue } from "@/domains/insights/stats";

describe("createSeededRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0, 1)", () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashSeed", () => {
  it("is stable and input-sensitive", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
});

describe("mean / median", () => {
  it("returns null on empty input", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
  });

  it("computes even- and odd-length medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe("permutationPValue", () => {
  it("returns a small p for a clear group difference", () => {
    // Two well-separated groups: labels obviously matter.
    const groupA = [80, 85, 82, 88, 84, 86, 83, 87, 81, 85];
    const groupB = [50, 55, 52, 58, 54, 56, 53, 57, 51, 55];
    const p = permutationPValue(groupA, groupB, { seed: 1 });
    expect(p).toBeLessThan(0.01);
  });

  it("returns a large p when groups are the same distribution", () => {
    // Interleaved values from one distribution: labels are meaningless.
    const groupA = [60, 62, 64, 66, 68, 70, 72, 74, 76, 78];
    const groupB = [61, 63, 65, 67, 69, 71, 73, 75, 77, 79];
    const p = permutationPValue(groupA, groupB, { seed: 1 });
    expect(p).toBeGreaterThan(0.3);
  });

  it("is reproducible for the same seed and never exactly 0", () => {
    const groupA = [10, 12, 14];
    const groupB = [11, 13, 15];
    expect(permutationPValue(groupA, groupB, { seed: 9 })).toBe(permutationPValue(groupA, groupB, { seed: 9 }));
    // The +1 finite-sample correction bounds p away from 0.
    expect(permutationPValue([100, 100, 100], [1, 1, 1], { seed: 3 })).toBeGreaterThan(0);
  });
});
