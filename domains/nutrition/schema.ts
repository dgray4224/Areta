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

export const nutritionSchema = z.object({
  height: z.number().positive().optional(),
  currentWeight: z.number().positive().optional(),
  targetWeight: z.number().positive().optional(),
  age: z.number().int().positive().optional(),
  /** Optional — only used to pick a BMR formula constant; the engine falls
   * back to a sex-neutral average when omitted. */
  sex: z.enum(["male", "female"]).optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
  availablePrepTimeMinutes: z.number().int().positive().optional(),
  householdServings: z.number().int().positive().optional(),
  foodPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  dislikedFoods: z.array(z.string()).optional(),
  favoriteMeals: z.array(z.string()).optional(),
  mealsPerDay: z.number().int().min(1).max(10).optional(),
  cookingAbility: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  groceryStores: z.array(z.string()).optional(),
  budget: z.string().optional(),
  appliances: z.array(z.string()).optional(),
  trackingPreference: z.enum(["detailed", "simple", "none"]).optional(),
  proteinTargetGrams: z.number().positive().optional(),
});

export type NutritionInput = z.infer<typeof nutritionSchema>;

/** Suggested chip options for the "select all that apply" onboarding
 * fields — a starting point the user can add to, not an exhaustive list. */
export const FOOD_PREFERENCE_SUGGESTIONS = [
  "High protein",
  "Low carb",
  "Mediterranean",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Dairy-free",
  "Gluten-free",
  "Whole foods",
  "Meal-prep friendly",
];

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

export const FAVORITE_MEAL_SUGGESTIONS = [
  "Breakfast",
  "Chicken bowls",
  "Stir fry",
  "Tacos",
  "Salads",
  "Pasta",
  "Grilled protein + veggies",
];

export const GROCERY_STORE_SUGGESTIONS = [
  "Costco",
  "Trader Joe's",
  "Whole Foods",
  "Kroger",
  "Walmart",
  "Safeway",
  "Aldi",
  "Local farmers market",
];

export const APPLIANCE_SUGGESTIONS = [
  "Instant Pot",
  "Air fryer",
  "Slow cooker",
  "Blender",
  "Grill",
  "Sheet pans",
  "Meal-prep containers",
  "Sous vide",
];
