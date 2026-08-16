import type { RecipeCuisine } from "@/domains/recipes/types";
import type { RECIPE_ALLERGENS } from "@/domains/recipes/schema";
import type { DietaryPattern } from "@/domains/nutrition/schema";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type RecipeAllergen = (typeof RECIPE_ALLERGENS)[number];

export type RecipeForPlanning = {
  id: string;
  name: string;
  mealType: MealType;
  /** Other slots this recipe also fits (recipes.also_suitable_for). The
   * pools below union it with `mealType`, so a dinner marked lunch-safe
   * is eligible for both. */
  alsoSuitableFor: MealType[];
  cuisine: RecipeCuisine;
  calories: number;
  proteinG: number;
  /** Recipe name + every ingredient name, lowercased, for keyword filtering. */
  searchableText: string;
  /** Structured Big 9 values from recipes.allergens (curated per recipe,
   * cross-checked by the content pipeline) — the reliable allergy filter,
   * unlike substring-matching "Dairy" against ingredient names that say
   * "Parmesan cheese". */
  allergens: string[];
  /** Free-text-ish curated tags (vegetarian/vegan/gluten-free/...). */
  dietaryTags: string[];
};

export type MealPlanGenerationInput = {
  calorieTarget: number;
  proteinTarget: number;
  /** How many meal slots per day (breakfast/lunch/dinner get priority; extras become snacks). */
  mealsPerDay: number;
  /** Lowercased keywords (allergies, dislikes) — any recipe containing one is excluded. */
  excludeKeywords: string[];
  /** Structured Big 9 allergens to exclude — a HARD filter matched against
   * each recipe's curated allergens column, NEVER relaxed by the
   * empty-pool fallback below (serving a dairy recipe to a dairy-allergic
   * user is a safety failure, not a variety failure). Mapped from the
   * user's free-text allergies in service.ts. */
  excludeAllergens?: RecipeAllergen[];
  /** HARD dietary-pattern filter (see domains/nutrition/schema.ts), also
   * never relaxed: vegan → vegan tag; vegetarian → vegetarian|vegan tag;
   * pescatarian → vegetarian|vegan tag OR a fish/shellfish recipe with no
   * meat keyword in its ingredients (fish-sauce-in-a-beef-dish would
   * otherwise slip through on the allergen signal alone — 9 of the
   * catalog's 51 fish-allergen recipes are meat dishes). */
  dietaryPattern?: DietaryPattern;
  /** Seed for the deterministic variety jitter (content-expansion 4b,
   * 2026-08-14): pass e.g. userId + ISO week so the same inputs produce a
   * different-but-stable plan each week instead of the argmin picking the
   * identical nearest-macro recipes forever. Omitted → no jitter (tests
   * and legacy callers keep exact determinism). */
  variantSeed?: string;
  /** Soft preference, not a filter -- recipes outside this list are never
   * excluded, just scored worse, so an empty/mismatched cuisine pool for a
   * given meal type can never break generation the way a hard filter
   * could (same failure mode excludeKeywords already guards against via
   * its own unfiltered-fallback, just avoided here by construction
   * instead of a fallback). Omitted/empty means no cuisine preference. */
  preferredCuisines?: RecipeCuisine[];
  recipes: RecipeForPlanning[];
  days?: number;
  /** Weekday indices (0 = Sunday) to actually plan meals for. Days left
   * out get no meals at all rather than an empty-but-present day, so the
   * grocery list (derived from meal_plan_items) reflects them too.
   * Omitted means every day, preserving the previous behaviour for any
   * caller that hasn't opted in. */
  plannedDaysOfWeek?: number[];
  /** recipeId -> how many times the user has explicitly picked it
   * (domains/mealplan/preferences.ts#getRecipePickFrequency, a bounded
   * lookback over meal_pick_history) -- an inferred soft nudge, same
   * weight class as preferredCuisines, applied only as a scoring bonus
   * AFTER the pool below is already filtered by MAX_USES_PER_WEEK/the
   * variety gap, so it can influence which eligible recipe wins but can
   * never bypass those caps. Omitted/empty means no history yet. */
  pickWeights?: Map<string, number>;
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

/** Maps the user's free-text allergy strings (onboarding TagPicker —
 * suggestions like "Dairy"/"Tree nuts"/"Gluten", but ultimately anything
 * they typed) onto the structured Big 9 vocabulary recipes declare. This
 * is what fixes the original correctness bug: "Dairy" never
 * substring-matched "Milk" or "Parmesan cheese", so a dairy-allergic
 * user could be served cheese. Order matters where one term contains
 * another (peanut before nut, shellfish before fish). Unmapped free text
 * (e.g. "strawberries") still gets the substring-keyword layer in
 * service.ts — this mapping is additive, not a replacement. */
const ALLERGY_TERM_MAP: [term: string, allergen: RecipeAllergen][] = [
  ["peanut", "peanuts"],
  ["shellfish", "shellfish"],
  ["shrimp", "shellfish"],
  ["prawn", "shellfish"],
  ["crab", "shellfish"],
  ["lobster", "shellfish"],
  ["fish", "fish"],
  ["milk", "milk"],
  ["dairy", "milk"],
  ["lactose", "milk"],
  ["cheese", "milk"],
  ["egg", "eggs"],
  ["tree nut", "tree_nuts"],
  ["nut", "tree_nuts"],
  ["almond", "tree_nuts"],
  ["walnut", "tree_nuts"],
  ["cashew", "tree_nuts"],
  ["pecan", "tree_nuts"],
  ["gluten", "wheat"],
  ["wheat", "wheat"],
  ["soy", "soybeans"],
  ["sesame", "sesame"],
];

export function mapAllergiesToAllergens(allergies: string[] | undefined | null): RecipeAllergen[] {
  if (!allergies) return [];
  const result = new Set<RecipeAllergen>();
  for (const raw of allergies) {
    let text = raw.trim().toLowerCase();
    if (!text) continue;
    // Consume each matched term so a contained term can't double-match:
    // "peanuts" must map to peanuts only (not tree_nuts via "nut"), and
    // "shellfish" to shellfish only (not fish via "fish") — the map is
    // ordered longest-/most-specific-first for exactly this reason.
    for (const [term, allergen] of ALLERGY_TERM_MAP) {
      if (text.includes(term)) {
        result.add(allergen);
        text = text.split(term).join(" ");
      }
    }
  }
  return [...result];
}

/** Ingredient words that mark a recipe as containing meat/poultry — used
 * only by the pescatarian rule below, checked against searchableText
 * (name + every ingredient name), so "fish sauce" in a beef stir-fry
 * can't make it pescatarian-eligible. */
const MEAT_KEYWORDS = [
  "beef",
  "chicken",
  "pork",
  "lamb",
  "turkey",
  "bacon",
  "ham",
  "sausage",
  "steak",
  "prosciutto",
  "chorizo",
  "duck",
  "veal",
];

function matchesDietaryPattern(recipe: RecipeForPlanning, pattern: DietaryPattern): boolean {
  if (pattern === "omnivore") return true;
  const tags = recipe.dietaryTags;
  if (pattern === "vegan") return tags.includes("vegan");
  if (pattern === "vegetarian") return tags.includes("vegetarian") || tags.includes("vegan");
  // pescatarian
  if (tags.includes("vegetarian") || tags.includes("vegan")) return true;
  const isSeafood = recipe.allergens.includes("fish") || recipe.allergens.includes("shellfish");
  return isSeafood && !MEAT_KEYWORDS.some((kw) => recipe.searchableText.includes(kw));
}

/** The non-relaxable constraints: structured allergens + dietary pattern.
 * Separate from isExcluded so the empty-pool fallback can relax keyword
 * dislikes without ever relaxing these. */
function violatesHardConstraints(
  recipe: RecipeForPlanning,
  excludeAllergens: RecipeAllergen[],
  dietaryPattern: DietaryPattern | undefined
): boolean {
  if (excludeAllergens.some((a) => recipe.allergens.includes(a))) return true;
  if (dietaryPattern && !matchesDietaryPattern(recipe, dietaryPattern)) return true;
  return false;
}

/** Tiny stable string hash (FNV-1a) for the variety jitter — local rather
 * than imported from domains/insights/stats.ts to keep mealplan free of a
 * cross-domain dependency for one line of math. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

  const excludeAllergens = input.excludeAllergens ?? [];
  const poolByType = new Map<MealType, RecipeForPlanning[]>();
  for (const mealType of MEAL_TYPES) {
    // Union of "this is a <mealType> recipe" and "this recipe also
    // works as <mealType>". Lunch and dinner overlap heavily in practice
    // and a strict partition was roughly halving the pool for anyone
    // with dietary restrictions -- see the also_suitable_for migration.
    const all = input.recipes.filter((r) => r.mealType === mealType || r.alsoSuitableFor.includes(mealType));
    // Hard constraints first (allergens + dietary pattern) — these are
    // never relaxed. The keyword fallback below only relaxes dislikes,
    // and only WITHIN the hard-compliant pool.
    const compliant = all.filter((r) => !violatesHardConstraints(r, excludeAllergens, input.dietaryPattern));
    if (compliant.length === 0 && all.length > 0) {
      warnings.push(
        `No ${mealType} recipes fit your dietary needs — this meal type was left unplanned. The recipe library needs more options for you.`
      );
      poolByType.set(mealType, []);
      continue;
    }
    let filtered = compliant.filter((r) => !isExcluded(r, input.excludeKeywords));
    if (filtered.length === 0 && compliant.length > 0) {
      warnings.push(
        `No ${mealType} recipes matched your exclusions — showing all options that fit your dietary needs for this meal type.`
      );
      filtered = compliant;
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
  const pickWeights = input.pickWeights;
  // Well below CUISINE_MISMATCH_PENALTY -- pick-history is an inferred
  // signal (the user chose this once, for some reason), not a stated
  // preference like preferredCuisines, so it should nudge rather than
  // dominate. Capped so a recipe picked 20 times doesn't permanently
  // crowd out everything else once pickWeights exists.
  const PREFERENCE_WEIGHT_PER_PICK = 10;
  const PREFERENCE_CAP_PICKS = 6;

  const usageCount = new Map<string, number>();
  const recentDays = new Map<string, number>(); // recipeId -> last day used

  const planDays: MealPlanDay[] = [];

  // A day the user does not want planned produces no MealPlanDay at all.
  // Emitting an empty day instead would still write a (present, empty)
  // day into the plan, and downstream code reads "has a day row" as
  // "this day is planned".
  const plannedDays = input.plannedDaysOfWeek;
  for (let day = 0; day < days; day++) {
    if (plannedDays && !plannedDays.includes(day)) continue;
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
        const withCuisine = cuisineMismatch ? base + CUISINE_MISMATCH_PENALTY : base;
        const pickCount = Math.min(pickWeights?.get(r.id) ?? 0, PREFERENCE_CAP_PICKS);
        // Variety jitter (4b, 2026-08-14): a deterministic per-seed,
        // per-recipe offset in [0, 45) — bigger than typical macro-score
        // gaps between similar recipes (so near-ties rotate week to week)
        // but well under CUISINE_MISMATCH_PENALTY (so it stays a shuffle
        // among suitable options, never overriding a stated preference).
        // Without a catalog-size-independent shake-up like this, a bigger
        // library adds zero felt variety: the same nearest-macro recipes
        // win every single week.
        const jitter = input.variantSeed ? hashString(`${input.variantSeed}:${r.id}`) % 45 : 0;
        return withCuisine - pickCount * PREFERENCE_WEIGHT_PER_PICK + jitter;
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
