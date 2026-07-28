import { describe, expect, it } from "vitest";
import { generateGroceryList, type IngredientNeed } from "@/domains/grocery/generate";

describe("generateGroceryList", () => {
  it("combines duplicate ingredients with the same name and unit", () => {
    const needs: IngredientNeed[] = [
      { name: "Eggs", quantity: 2, unit: "count", section: "dairy", recipeName: "Scramble" },
      { name: "Eggs", quantity: 2, unit: "count", section: "dairy", recipeName: "Hard-Boiled Eggs" },
    ];
    const result = generateGroceryList(needs);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(4);
    expect(result[0].neededFor).toEqual(["Scramble", "Hard-Boiled Eggs"]);
  });

  it("keeps different units for the same ingredient as separate line items", () => {
    const needs: IngredientNeed[] = [
      { name: "Brown rice", quantity: 0.5, unit: "cup dry", section: "pantry", recipeName: "A" },
      { name: "Brown rice", quantity: 0.75, unit: "cup cooked", section: "pantry", recipeName: "B" },
    ];
    const result = generateGroceryList(needs);
    expect(result).toHaveLength(2);
  });

  it("subtracts on-hand inventory and floors at zero", () => {
    const needs: IngredientNeed[] = [
      { name: "Olive oil", quantity: 3, unit: "tbsp", section: "pantry", recipeName: "A" },
    ];
    const result = generateGroceryList(needs, [{ name: "Olive oil", quantity: 5, unit: "tbsp" }]);
    expect(result).toHaveLength(0);
  });

  it("reduces quantity by partial inventory instead of removing the item", () => {
    const needs: IngredientNeed[] = [
      { name: "Chicken breast", quantity: 10, unit: "oz", section: "protein", recipeName: "A" },
    ];
    const result = generateGroceryList(needs, [{ name: "Chicken breast", quantity: 4, unit: "oz" }]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(6);
  });

  it("groups and sorts items by store-section order", () => {
    const needs: IngredientNeed[] = [
      { name: "Rice", quantity: 1, unit: "cup", section: "pantry", recipeName: "A" },
      { name: "Spinach", quantity: 1, unit: "cup", section: "produce", recipeName: "A" },
      { name: "Chicken", quantity: 1, unit: "lb", section: "protein", recipeName: "A" },
    ];
    const result = generateGroceryList(needs);
    expect(result.map((r) => r.section)).toEqual(["produce", "protein", "pantry"]);
  });

  it("is case-insensitive when matching ingredient and inventory names", () => {
    const needs: IngredientNeed[] = [
      { name: "eggs", quantity: 2, unit: "count", section: "dairy", recipeName: "A" },
    ];
    const result = generateGroceryList(needs, [{ name: "EGGS", quantity: 2, unit: "COUNT" }]);
    expect(result).toHaveLength(0);
  });
});
