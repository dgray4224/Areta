export type PrepRecipeInfo = {
  name: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  needsOven: boolean;
  hasProduceToWash: boolean;
  hasProteinToCook: boolean;
  hasCarbToCook: boolean;
};

export type PrepPlanGenerationInput = {
  uniqueRecipes: PrepRecipeInfo[];
  totalMealCount: number;
};

export type PrepStepDraft = {
  stepNumber: number;
  instruction: string;
};

export type PrepPlanGenerationResult = {
  steps: PrepStepDraft[];
  estimatedMinutes: number;
  containerCount: number;
  expectedLeftoverRecipes: string[];
};

/**
 * Deterministic Sunday prep workflow generator, following CLAUDE.md's exact
 * ordered template ("Sunday prep plan"): preheat, longest-cooking items
 * first, wash/cut produce, cook proteins, cook carbs, portion, label,
 * store, update inventory, clean up. Steps that don't apply this week (e.g.
 * nothing needs the oven) are simply omitted rather than left blank.
 */
export function generatePrepPlan(input: PrepPlanGenerationInput): PrepPlanGenerationResult {
  const { uniqueRecipes, totalMealCount } = input;

  const candidateSteps: { applies: boolean; instruction: string }[] = [
    {
      applies: uniqueRecipes.some((r) => r.needsOven),
      instruction: "Preheat the oven.",
    },
    {
      applies: uniqueRecipes.some((r) => r.cookMinutes > 0),
      instruction: `Start the longest-cooking items first: ${uniqueRecipes
        .filter((r) => r.cookMinutes > 0)
        .sort((a, b) => b.cookMinutes - a.cookMinutes)
        .map((r) => `${r.name} (${r.cookMinutes} min)`)
        .join(", ")}.`,
    },
    {
      applies: uniqueRecipes.some((r) => r.hasProduceToWash),
      instruction: `Wash and cut produce for: ${uniqueRecipes
        .filter((r) => r.hasProduceToWash)
        .map((r) => r.name)
        .join(", ")}.`,
    },
    {
      applies: uniqueRecipes.some((r) => r.hasProteinToCook),
      instruction: `Cook proteins for: ${uniqueRecipes
        .filter((r) => r.hasProteinToCook)
        .map((r) => r.name)
        .join(", ")}.`,
    },
    {
      applies: uniqueRecipes.some((r) => r.hasCarbToCook),
      instruction: `Cook carbohydrates for: ${uniqueRecipes
        .filter((r) => r.hasCarbToCook)
        .map((r) => r.name)
        .join(", ")}.`,
    },
    {
      applies: totalMealCount > 0,
      instruction: `Portion meals into roughly ${totalMealCount} containers for the week.`,
    },
    {
      applies: totalMealCount > 0,
      instruction: "Label containers with the meal name and day.",
    },
    {
      applies: totalMealCount > 0,
      instruction: "Store food in the fridge or freezer as appropriate for each recipe.",
    },
    {
      applies: true,
      instruction: "Update your inventory with any leftover ingredients.",
    },
    {
      applies: true,
      instruction: "Clean the kitchen.",
    },
  ];

  const steps: PrepStepDraft[] = candidateSteps
    .filter((s) => s.applies)
    .map((s, i) => ({ stepNumber: i + 1, instruction: s.instruction }));

  // Prep (chopping, measuring) is hands-on and serial — one person can only
  // do one at a time. Cook time is mostly hands-off and overlaps: it's the
  // whole reason the steps above say "start the longest-cooking items
  // first" and prep everything else while they run. Summing every recipe's
  // cook time as if nothing ever happened in parallel wildly overstates a
  // real Sunday session, so only the single longest cook time counts.
  const totalPrepMinutes = uniqueRecipes.reduce((sum, r) => sum + r.prepMinutes, 0);
  const longestCookMinutes = uniqueRecipes.reduce((max, r) => Math.max(max, r.cookMinutes), 0);
  const estimatedMinutes = totalPrepMinutes + longestCookMinutes;

  const expectedLeftoverRecipes = uniqueRecipes.filter((r) => r.servings > 1).map((r) => r.name);

  return {
    steps,
    estimatedMinutes,
    containerCount: totalMealCount,
    expectedLeftoverRecipes,
  };
}
