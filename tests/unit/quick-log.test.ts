import { describe, expect, it } from "vitest";
import { QUICK_ESTIMATE_NOTE, quickEstimate } from "@/domains/nutrition/quick-log";

describe("quickEstimate (two-tap 'ate out' log)", () => {
  it("books a share of the person's own targets, rounded so it never reads as measured", () => {
    const normal = quickEstimate("normal", { calories: 2240, protein: 165 });
    expect(normal.food).toBe("Ate out (normal)");
    expect(normal.calories).toBe(800); // 2240 * 0.35 = 784 → nearest 50
    expect(normal.protein).toBe(60); // 165 * 0.35 = 57.75 → nearest 5
    expect(normal.notes).toBe(QUICK_ESTIMATE_NOTE);
  });

  it("orders light < normal < big", () => {
    const t = { calories: 2000, protein: 120 };
    const [light, normal, big] = ["light", "normal", "big"].map((b) => quickEstimate(b as "light" | "normal" | "big", t).calories);
    expect(light).toBeLessThan(normal);
    expect(normal).toBeLessThan(big);
  });

  it("falls back to a plain maintenance day when no targets are approved yet", () => {
    const big = quickEstimate("big", { calories: null, protein: null });
    expect(big.calories).toBe(1000);
    expect(big.protein).toBe(60);
  });
});
