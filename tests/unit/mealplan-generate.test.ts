import { describe, expect, it } from "vitest";
import { generateMealPlan, type RecipeForPlanning } from "@/domains/mealplan/generate";

function recipe(overrides: Partial<RecipeForPlanning>): RecipeForPlanning {
  return {
    id: "r1",
    name: "Test Recipe",
    mealType: "breakfast",
    cuisine: "american",
    calories: 400,
    proteinG: 25,
    searchableText: "test recipe",
    allergens: [],
    dietaryTags: [],
    ...overrides,
  };
}

const SAMPLE_RECIPES: RecipeForPlanning[] = [
  recipe({ id: "b1", name: "Eggs", mealType: "breakfast", calories: 320, proteinG: 22, searchableText: "eggs spinach" }),
  recipe({ id: "b2", name: "Oats", mealType: "breakfast", calories: 420, proteinG: 18, searchableText: "oats peanut butter banana" }),
  recipe({ id: "b3", name: "Yogurt Parfait", mealType: "breakfast", calories: 350, proteinG: 25, searchableText: "greek yogurt berries granola" }),
  recipe({ id: "b4", name: "Smoothie", mealType: "breakfast", calories: 380, proteinG: 35, searchableText: "protein smoothie banana spinach" }),
  recipe({ id: "l1", name: "Chicken Salad", mealType: "lunch", calories: 450, proteinG: 40, searchableText: "chicken salad feta" }),
  recipe({ id: "l2", name: "Bean Bowl", mealType: "lunch", calories: 480, proteinG: 18, searchableText: "black beans rice" }),
  recipe({ id: "d1", name: "Salmon", mealType: "dinner", calories: 520, proteinG: 40, searchableText: "salmon broccoli" }),
  recipe({ id: "d2", name: "Chili", mealType: "dinner", calories: 430, proteinG: 38, searchableText: "turkey chili beans" }),
  recipe({ id: "s1", name: "Apple", mealType: "snack", calories: 250, proteinG: 6, searchableText: "apple almond butter" }),
];

describe("generateMealPlan", () => {
  it("fills 7 days with breakfast/lunch/dinner for a 3-meal plan", () => {
    const { days } = generateMealPlan({
      calorieTarget: 2000,
      proteinTarget: 150,
      mealsPerDay: 3,
      excludeKeywords: [],
      recipes: SAMPLE_RECIPES,
    });

    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(day.meals.map((m) => m.mealType)).toEqual(["breakfast", "lunch", "dinner"]);
      expect(day.totalCalories).toBeGreaterThan(0);
    }
  });

  it("adds snack slots beyond 3 meals per day", () => {
    const { days } = generateMealPlan({
      calorieTarget: 2200,
      proteinTarget: 160,
      mealsPerDay: 4,
      excludeKeywords: [],
      recipes: SAMPLE_RECIPES,
    });

    expect(days[0].meals.map((m) => m.mealType)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });

  it("excludes recipes matching an allergy/dislike keyword", () => {
    const { days, warnings } = generateMealPlan({
      calorieTarget: 2000,
      proteinTarget: 150,
      mealsPerDay: 3,
      excludeKeywords: ["salmon"],
      recipes: SAMPLE_RECIPES,
    });

    const dinnerRecipeIds = days.map((d) => d.meals.find((m) => m.mealType === "dinner")?.recipeId);
    expect(dinnerRecipeIds).not.toContain("d1");
    expect(warnings).toHaveLength(0); // "Chili" is still available, so no fallback warning
  });

  it("falls back to unfiltered recipes with a warning when exclusions remove an entire meal type", () => {
    const { warnings } = generateMealPlan({
      calorieTarget: 2000,
      proteinTarget: 150,
      mealsPerDay: 3,
      excludeKeywords: ["salmon", "chili", "turkey"], // wipes out both dinners
      recipes: SAMPLE_RECIPES,
    });

    expect(warnings.some((w) => w.includes("dinner"))).toBe(true);
  });

  it("does not add a meal slot when no recipes exist for that meal type", () => {
    const noSnacks = SAMPLE_RECIPES.filter((r) => r.mealType !== "snack");
    const { days } = generateMealPlan({
      calorieTarget: 2000,
      proteinTarget: 150,
      mealsPerDay: 4,
      excludeKeywords: [],
      recipes: noSnacks,
    });

    expect(days[0].meals.map((m) => m.mealType)).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("caps any single recipe at 2 uses per week when alternatives exist", () => {
    const { days } = generateMealPlan({
      calorieTarget: 2000,
      proteinTarget: 150,
      mealsPerDay: 3,
      excludeKeywords: [],
      recipes: SAMPLE_RECIPES,
    });

    const breakfastCounts = new Map<string, number>();
    for (const day of days) {
      const breakfast = day.meals.find((m) => m.mealType === "breakfast");
      if (breakfast) {
        breakfastCounts.set(breakfast.recipeId, (breakfastCounts.get(breakfast.recipeId) ?? 0) + 1);
      }
    }
    for (const count of breakfastCounts.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  describe("pickWeights (frequency-weighting)", () => {
    const A = recipe({ id: "pw-a", mealType: "breakfast", calories: 400, proteinG: 25 });
    const B = recipe({ id: "pw-b", mealType: "breakfast", calories: 420, proteinG: 25 });

    it("a macro-worse recipe with a higher pick count wins over an untouched better-fit recipe", () => {
      const withoutHistory = generateMealPlan({
        days: 1,
        calorieTarget: 400,
        proteinTarget: 25,
        mealsPerDay: 1,
        excludeKeywords: [],
        recipes: [A, B],
      });
      expect(withoutHistory.days[0].meals[0].recipeId).toBe("pw-a"); // closer macro fit wins with no history

      const withHistory = generateMealPlan({
        days: 1,
        calorieTarget: 400,
        proteinTarget: 25,
        mealsPerDay: 1,
        excludeKeywords: [],
        recipes: [A, B],
        pickWeights: new Map([["pw-b", 3]]),
      });
      expect(withHistory.days[0].meals[0].recipeId).toBe("pw-b"); // pick-history bonus flips the choice
    });

    it("does not let a high pick count bypass the MAX_USES_PER_WEEK cap", () => {
      const { days } = generateMealPlan({
        days: 3,
        calorieTarget: 400,
        proteinTarget: 25,
        mealsPerDay: 1,
        excludeKeywords: [],
        recipes: [A, B],
        pickWeights: new Map([["pw-b", 100]]), // huge bonus -- would win every day if caps didn't apply
      });

      const bCount = days.filter((d) => d.meals[0].recipeId === "pw-b").length;
      expect(bCount).toBeLessThanOrEqual(2); // still capped, same as the uses-per-week test above
      expect(days.some((d) => d.meals[0].recipeId === "pw-a")).toBe(true); // the 3rd day had to fall back to A
    });

    it("produces identical output whether pickWeights is omitted or an empty Map", () => {
      const omitted = generateMealPlan({
        calorieTarget: 2000,
        proteinTarget: 150,
        mealsPerDay: 3,
        excludeKeywords: [],
        recipes: SAMPLE_RECIPES,
      });
      const empty = generateMealPlan({
        calorieTarget: 2000,
        proteinTarget: 150,
        mealsPerDay: 3,
        excludeKeywords: [],
        recipes: SAMPLE_RECIPES,
        pickWeights: new Map(),
      });
      expect(empty).toEqual(omitted);
    });
  });
});

// --- Content-expansion 4a/4b (2026-08-14): hard dietary filters + variety ---
import { mapAllergiesToAllergens } from "@/domains/mealplan/generate";

describe("mapAllergiesToAllergens", () => {
  it("maps common free-text allergy phrasings onto the Big 9", () => {
    expect(mapAllergiesToAllergens(["Dairy"])).toEqual(["milk"]);
    expect(mapAllergiesToAllergens(["Gluten"])).toEqual(["wheat"]);
    expect(mapAllergiesToAllergens(["Tree nuts", "Soy"])).toEqual(["tree_nuts", "soybeans"]);
  });

  it("does not double-match contained terms", () => {
    expect(mapAllergiesToAllergens(["Peanuts"])).toEqual(["peanuts"]);
    expect(mapAllergiesToAllergens(["Shellfish"])).toEqual(["shellfish"]);
  });

  it("passes unmappable free text through as nothing (keyword layer handles it)", () => {
    expect(mapAllergiesToAllergens(["strawberries"])).toEqual([]);
  });
});

describe("hard dietary constraints", () => {
  const dairyBreakfasts = [
    recipe({ id: "db1", name: "Parmesan Omelette", allergens: ["milk", "eggs"], searchableText: "parmesan cheese omelette" }),
    recipe({ id: "db2", name: "Yogurt Bowl", allergens: ["milk"], searchableText: "greek yogurt honey" }),
  ];
  const safeBreakfast = recipe({ id: "sb1", name: "Oatmeal", calories: 400, searchableText: "oats banana" });

  it("never serves an excluded allergen, even when the pool would empty", () => {
    const result = generateMealPlan({
      calorieTarget: 1200,
      proteinTarget: 75,
      mealsPerDay: 1,
      excludeKeywords: [],
      excludeAllergens: ["milk"],
      recipes: dairyBreakfasts,
      days: 3,
    });
    // No fallback to non-compliant recipes: slots stay unplanned.
    expect(result.days.every((d) => d.meals.length === 0)).toBe(true);
    expect(result.warnings.some((w) => w.includes("dietary needs"))).toBe(true);
  });

  it("keeps the keyword fallback inside the compliant pool only", () => {
    const result = generateMealPlan({
      calorieTarget: 1200,
      proteinTarget: 75,
      mealsPerDay: 1,
      // Keyword excludes ALL breakfasts -> fallback relaxes dislikes but
      // still never crosses the allergen line.
      excludeKeywords: ["oats", "omelette", "yogurt"],
      excludeAllergens: ["milk"],
      recipes: [...dairyBreakfasts, safeBreakfast],
      days: 3,
    });
    const planned = result.days.flatMap((d) => d.meals.map((m) => m.recipeId));
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((id) => id === "sb1")).toBe(true);
  });

  it("vegan pattern only plans vegan-tagged recipes", () => {
    const result = generateMealPlan({
      calorieTarget: 1200,
      proteinTarget: 75,
      mealsPerDay: 1,
      excludeKeywords: [],
      dietaryPattern: "vegan",
      recipes: [
        recipe({ id: "v1", name: "Tofu Scramble", dietaryTags: ["vegan", "vegetarian"] }),
        recipe({ id: "nv1", name: "Eggs Benedict", dietaryTags: ["vegetarian"] }),
        recipe({ id: "nv2", name: "Bacon Hash", dietaryTags: [] }),
      ],
      days: 3,
    });
    const planned = result.days.flatMap((d) => d.meals.map((m) => m.recipeId));
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((id) => id === "v1")).toBe(true);
  });

  it("pescatarian allows fish and vegetarian but blocks meat-with-fish-sauce", () => {
    const result = generateMealPlan({
      calorieTarget: 1200,
      proteinTarget: 75,
      mealsPerDay: 1,
      excludeKeywords: [],
      dietaryPattern: "pescatarian",
      recipes: [
        recipe({ id: "p1", name: "Salmon Teriyaki", allergens: ["fish"], searchableText: "salmon rice" }),
        recipe({ id: "p2", name: "Veggie Curry", dietaryTags: ["vegetarian"], searchableText: "chickpea curry" }),
        recipe({ id: "bad1", name: "Thai Beef Stir-fry", allergens: ["fish"], searchableText: "beef fish sauce basil" }),
        recipe({ id: "bad2", name: "Chicken Rice", searchableText: "chicken rice" }),
      ],
      days: 6,
    });
    const planned = new Set(result.days.flatMap((d) => d.meals.map((m) => m.recipeId)));
    expect(planned.has("bad1")).toBe(false);
    expect(planned.has("bad2")).toBe(false);
    expect(planned.has("p1") || planned.has("p2")).toBe(true);
  });
});

describe("variety jitter (variantSeed)", () => {
  const bigPool = Array.from({ length: 10 }, (_, i) =>
    recipe({ id: `br${i}`, name: `Breakfast ${i}`, calories: 395 + i, proteinG: 24 + (i % 3) })
  );

  it("is stable for the same seed and shuffles across seeds", () => {
    const base = { calorieTarget: 1200, proteinTarget: 75, mealsPerDay: 1, excludeKeywords: [], recipes: bigPool, days: 7 };
    const weekA1 = generateMealPlan({ ...base, variantSeed: "user:2026-08-10" });
    const weekA2 = generateMealPlan({ ...base, variantSeed: "user:2026-08-10" });
    const weekB = generateMealPlan({ ...base, variantSeed: "user:2026-08-17" });
    const ids = (r: typeof weekA1) => r.days.flatMap((d) => d.meals.map((m) => m.recipeId)).join(",");
    expect(ids(weekA1)).toBe(ids(weekA2));
    expect(ids(weekA1)).not.toBe(ids(weekB));
  });
});
