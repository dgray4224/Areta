import { z } from "zod";

/** Phase 1 onboarding only captures preferences and current/target state —
 * deterministic calorie/protein targets are derived in Phase 3's
 * Outcome-to-Operating-Parameters engine, not asked here (CLAUDE.md §5A). */
export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Trimmed to the fields the nutrition engine actually consumes
 * (2026-08-07 onboarding consolidation): every field here is read by
 * calculateNutritionParameters (height/currentWeight/targetWeight/age/
 * sex/activityLevel/trackingPreference/proteinTargetGrams) or
 * generateAndSaveMealPlan (allergies/dislikedFoods/mealsPerDay). The
 * previously-asked preference fields (foodPreferences, favoriteMeals,
 * cookingAbility, groceryStores, budget, appliances,
 * availablePrepTimeMinutes, householdServings) were write-only -- never
 * read anywhere downstream -- and were removed from both the schema and
 * the web/mobile forms. Old stored blobs keep those keys harmlessly
 * (zod strips unknown keys on parse; the jsonb column is untouched). */
/** Dietary pattern (2026-08-14, content-expansion 4a): a HARD filter for
 * meal-plan generation — unlike allergies' old substring matching, this
 * gates on recipes' curated dietaryTags/allergens and is never relaxed by
 * a fallback. Optional; absent means omnivore for every existing user (no
 * backfill needed). */
export const DIETARY_PATTERNS = ["omnivore", "vegetarian", "pescatarian", "vegan"] as const;
export type DietaryPattern = (typeof DIETARY_PATTERNS)[number];

export const DIETARY_PATTERN_LABELS: Record<DietaryPattern, string> = {
  omnivore: "No restriction",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  vegan: "Vegan",
};

export const nutritionSchema = z.object({
  height: z.number().positive().optional(),
  currentWeight: z.number().positive().optional(),
  targetWeight: z.number().positive().optional(),
  age: z.number().int().positive().optional(),
  /** Optional — only used to pick a BMR formula constant; the engine falls
   * back to a sex-neutral average when omitted. */
  sex: z.enum(["male", "female"]).optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
  allergies: z.array(z.string()).optional(),
  dietaryPattern: z.enum(DIETARY_PATTERNS).optional(),
  dislikedFoods: z.array(z.string()).optional(),
  mealsPerDay: z.number().int().min(1).max(10).optional(),
  trackingPreference: z.enum(["detailed", "simple", "none"]).optional(),
  proteinTargetGrams: z.number().positive().optional(),
});

export type NutritionInput = z.infer<typeof nutritionSchema>;

/** Suggested chip options for the "select all that apply" onboarding
 * fields — a starting point the user can add to, not an exhaustive list. */
export const ALLERGY_SUGGESTIONS = [
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Dairy",
  "Eggs",
  "Gluten",
  "Soy",
];

export const DISLIKED_FOOD_SUGGESTIONS = [
  "Mushrooms",
  "Cilantro",
  "Seafood",
  "Spicy food",
  "Organ meats",
  "Beans",
  "Onions",
];

