import type { RecipeCuisine } from "@/domains/recipes/types";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type RecipeForPlanning = {
  id: string;
  name: string;
  mealType: MealType;
  cuisine: RecipeCuisine;
  calories: number;
  proteinG: number;
  /** Recipe name + every ingredient name, lowercased, for keyword filtering. */
  searchableText: string;
};

export type MealPlanGenerationInput = {
  calorieTarget: number;
  proteinTarget: number;
  /** How many meal slots per day (breakfast/lunch/dinner get priority; extras become snacks). */
  mealsPerDay: number;
  /** Lowercased keywords (allergies, dislikes) — any recipe containing one is excluded. */
  excludeKeywords: string[];
  /** Soft preference, not a filter -- recipes outside this list are never
   * excluded, just scored worse, so an empty/mismatched cuisine pool for a
   * given meal type can never break generation the way a hard filter
   * could (same failure mode excludeKeywords already guards against via
   * its own unfiltered-fallback, just avoided here by construction
   * instead of a fallback). Omitted/empty means no cuisine preference. */
  preferredCuisines?: RecipeCuisine[];
  recipes: RecipeForPlanning[];
  days?: number;
};

export type PlannedMeal = { mealType: MealType; recipeId: string };
export type MealPlanDay = {
  dayOfWeek: number;
  meals: PlannedMeal[];
  totalCalories: number;
  totalProtein: number;
};

export type MealPlanGenerationResult = {
  days: MealPlanDay[];
  warnings: string[];
};

const MAX_USES_PER_WEEK = 2;

function slotsForMealsPerDay(mealsPerDay: number): MealType[] {
  const base: MealType[] = ["breakfast", "lunch", "dinner"];
  if (mealsPerDay <= 0) return base;
  if (mealsPerDay < 3) return base.slice(0, mealsPerDay);
  const extraSnacks = mealsPerDay - 3;
  return [...base, ...Array(extraSnacks).fill("snack")];
}

function isExcluded(recipe: RecipeForPlanning, excludeKeywords: string[]): boolean {
  return excludeKeywords.some((kw) => kw && recipe.searchableText.includes(kw));
}

/**
 * Deterministic, rule-based 7-day meal plan generator (CLAUDE.md Phase 3
 * "Meal-plan outputs"). No AI — the recipe library and greedy nearest-target
 * selection do the work, matching CLAUDE.md rule 6 (deterministic code for
 * calculations).
 */
export function generateMealPlan(input: MealPlanGenerationInput): MealPlanGenerationResult {
  const days = input.days ?? 7;
  const slots = slotsForMealsPerDay(input.mealsPerDay);
  const warnings: string[] = [];

  const poolByType = new Map<MealType, RecipeForPlanning[]>();
  for (const mealType of MEAL_TYPES) {
    const all = input.recipes.filter((r) => r.mealType === mealType);
    let filtered = all.filter((r) => !isExcluded(r, input.excludeKeywords));
    if (filtered.length === 0 && all.length > 0) {
      warnings.push(
        `No ${mealType} recipes matched your exclusions — showing unfiltered options for this meal type.`
      );
      filtered = all;
    }
    poolByType.set(mealType, filtered);
  }

  const slotCalorieTarget = input.calorieTarget / slots.length;
  const slotProteinTarget = input.proteinTarget / slots.length;
  const preferredCuisines = input.preferredCuisines ?? [];
  // Sized relative to typical calorie/protein score deltas (tens to low
  // hundreds) -- big enough to reliably win a tiebreak toward a preferred
  // cuisine, small enough that a much-better macro fit outside the
  // preference can still win, keeping this a nudge, not a filter.
  const CUISINE_MISMATCH_PENALTY = 150;

  const usageCount = new Map<string, number>();
  const recentDays = new Map<string, number>(); // recipeId -> last day used

  const planDays: MealPlanDay[] = [];

  for (let day = 0; day < days; day++) {
    const meals: PlannedMeal[] = [];
    const usedToday = new Set<string>();
    let totalCalories = 0;
    let totalProtein = 0;

    for (const mealType of slots) {
      const pool = poolByType.get(mealType) ?? [];
      if (pool.length === 0) {
        continue;
      }

      const notUsedToday = pool.filter((r) => !usedToday.has(r.id));
      const underCap = notUsedToday.filter((r) => (usageCount.get(r.id) ?? 0) < MAX_USES_PER_WEEK);
      // Relax the 2-day variety gap before relaxing the weekly usage cap —
      // repeating a meal sooner is preferable to exceeding MAX_USES_PER_WEEK.
      const respectingGap = underCap.filter((r) => {
        const lastUsed = recentDays.get(r.id);
        return lastUsed === undefined || day - lastUsed >= 2;
      });
      const options =
        respectingGap.length > 0
          ? respectingGap
          : underCap.length > 0
            ? underCap
            : notUsedToday.length > 0
              ? notUsedToday
              : pool;

      const scoreOf = (r: RecipeForPlanning) => {
        const base = Math.abs(r.calories - slotCalorieTarget) + Math.abs(r.proteinG - slotProteinTarget) * 2;
        const cuisineMismatch = preferredCuisines.length > 0 && !preferredCuisines.includes(r.cuisine);
        return cuisineMismatch ? base + CUISINE_MISMATCH_PENALTY : base;
      };
      const chosen = options.reduce((best, r) => (scoreOf(r) < scoreOf(best) ? r : best), options[0]);

      meals.push({ mealType, recipeId: chosen.id });
      usedToday.add(chosen.id);
      usageCount.set(chosen.id, (usageCount.get(chosen.id) ?? 0) + 1);
      recentDays.set(chosen.id, day);
      totalCalories += chosen.calories;
      totalProtein += chosen.proteinG;
    }

    planDays.push({ dayOfWeek: day, meals, totalCalories, totalProtein });
  }

  return { days: planDays, warnings };
}
