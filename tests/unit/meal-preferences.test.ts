import { describe, expect, it } from "vitest";
import { nutritionSchema } from "@/domains/nutrition/schema";
import { generateMealPlan, type RecipeForPlanning } from "@/domains/mealplan/generate";

// Every fixture works for all three slots so a 3-meal day draws from one
// pool and the cuisine choice is the only thing that differs.
function recipe(overrides: Partial<RecipeForPlanning>): RecipeForPlanning {
  return {
    id: "r1",
    name: "Test Recipe",
    mealType: "dinner",
    alsoSuitableFor: ["breakfast", "lunch"],
    cuisine: "american",
    calories: 500,
    proteinG: 40,
    searchableText: "test recipe",
    allergens: [],
    dietaryTags: [],
    ...overrides,
  };
}

describe("preferredCuisines (the onboarding 'what do you like to eat?' answer)", () => {
  it("is accepted by the nutrition schema and rejects cuisines the library doesn't have", () => {
    expect(nutritionSchema.safeParse({ preferredCuisines: ["american", "mexican"] }).success).toBe(true);
    expect(nutritionSchema.safeParse({ preferredCuisines: ["french"] }).success).toBe(false);
    expect(nutritionSchema.safeParse({}).success).toBe(true);
  });

  it("steers every meal toward the preferred cuisines when macros are a wash", () => {
    // Enough preferred recipes that the weekly repeat cap never forces the
    // generator outside them -- that cap is a hard rule, the cuisine is a
    // preference, and the real library has 170+ American recipes alone.
    const recipes = [
      recipe({ id: "it1", name: "Cacio e Pepe", cuisine: "italian" }),
      recipe({ id: "it2", name: "Risotto", cuisine: "italian" }),
      recipe({ id: "it3", name: "Lasagna", cuisine: "italian" }),
      ...Array.from({ length: 8 }, (_, i) => recipe({ id: `mx${i}`, name: `Mexican ${i}`, cuisine: "mexican" })),
      ...Array.from({ length: 8 }, (_, i) => recipe({ id: `us${i}`, name: `American ${i}`, cuisine: "american" })),
    ];
    const { days } = generateMealPlan({
      calorieTarget: 1500,
      proteinTarget: 120,
      mealsPerDay: 3,
      excludeKeywords: [],
      recipes,
      preferredCuisines: ["mexican", "american"],
    });
    const cuisineOf = new Map(recipes.map((r) => [r.id, r.cuisine]));
    const chosen = days.flatMap((d) => d.meals.map((m) => cuisineOf.get(m.recipeId)));
    expect(chosen.length).toBe(21);
    expect(chosen.every((c) => c === "mexican" || c === "american")).toBe(true);
  });

  it("still fills every slot from other cuisines when the preferred ones can't", () => {
    const recipes = [recipe({ id: "it1", name: "Cacio e Pepe", cuisine: "italian" })];
    const { days } = generateMealPlan({
      calorieTarget: 1500,
      proteinTarget: 120,
      mealsPerDay: 3,
      excludeKeywords: [],
      recipes,
      preferredCuisines: ["mexican"],
    });
    expect(days.every((d) => d.meals.length === 3)).toBe(true);
  });
});
