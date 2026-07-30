import { describe, expect, it } from "vitest";
import { generatePrepPlan, type PrepRecipeInfo } from "@/domains/prep/generate";

function recipe(overrides: Partial<PrepRecipeInfo>): PrepRecipeInfo {
  return {
    name: "Test",
    prepMinutes: 10,
    cookMinutes: 10,
    servings: 1,
    needsOven: false,
    hasProduceToWash: false,
    hasProteinToCook: false,
    hasCarbToCook: false,
    ...overrides,
  };
}

describe("generatePrepPlan", () => {
  it("numbers steps sequentially with no gaps when some steps don't apply", () => {
    const result = generatePrepPlan({
      uniqueRecipes: [recipe({ name: "Yogurt Bowl", cookMinutes: 0, prepMinutes: 3 })],
      totalMealCount: 3,
    });

    const numbers = result.steps.map((s) => s.stepNumber);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
  });

  it("includes a preheat step only when a recipe needs the oven", () => {
    const withOven = generatePrepPlan({
      uniqueRecipes: [recipe({ needsOven: true })],
      totalMealCount: 1,
    });
    const withoutOven = generatePrepPlan({
      uniqueRecipes: [recipe({ needsOven: false })],
      totalMealCount: 1,
    });

    expect(withOven.steps.some((s) => s.instruction.includes("Preheat"))).toBe(true);
    expect(withoutOven.steps.some((s) => s.instruction.includes("Preheat"))).toBe(false);
  });

  it("orders the longest-cooking items first in that step's instruction", () => {
    const result = generatePrepPlan({
      uniqueRecipes: [
        recipe({ name: "Quick Thing", cookMinutes: 5 }),
        recipe({ name: "Slow Roast", cookMinutes: 40 }),
      ],
      totalMealCount: 2,
    });

    const step = result.steps.find((s) => s.instruction.startsWith("Start the longest"));
    expect(step?.instruction.indexOf("Slow Roast")).toBeLessThan(step?.instruction.indexOf("Quick Thing") ?? -1);
  });

  it("sums prep time but only counts the longest cook time, since cooking overlaps", () => {
    const result = generatePrepPlan({
      uniqueRecipes: [
        recipe({ prepMinutes: 10, cookMinutes: 20 }),
        recipe({ prepMinutes: 5, cookMinutes: 15 }),
      ],
      totalMealCount: 5,
    });
    // prep: 10 + 5 = 15 (serial, hands-on). cook: max(20, 15) = 20 (overlaps).
    expect(result.estimatedMinutes).toBe(35);
  });

  it("identifies multi-serving recipes as expected leftovers", () => {
    const result = generatePrepPlan({
      uniqueRecipes: [
        recipe({ name: "Chili", servings: 2 }),
        recipe({ name: "Single Bowl", servings: 1 }),
      ],
      totalMealCount: 2,
    });
    expect(result.expectedLeftoverRecipes).toEqual(["Chili"]);
  });

  it("always includes update-inventory and clean-kitchen steps even with zero meals", () => {
    const result = generatePrepPlan({ uniqueRecipes: [], totalMealCount: 0 });
    const instructions = result.steps.map((s) => s.instruction);
    expect(instructions).toContain("Update your inventory with any leftover ingredients.");
    expect(instructions).toContain("Clean the kitchen.");
  });

  it("sets containerCount to the total meal count", () => {
    const result = generatePrepPlan({ uniqueRecipes: [recipe({})], totalMealCount: 14 });
    expect(result.containerCount).toBe(14);
  });
});
