import { z } from "zod";

/** Phase 1 onboarding only captures preferences and current/target state —
 * deterministic calorie/protein targets are derived in Phase 3's
 * Outcome-to-Operating-Parameters engine, not asked here (CLAUDE.md §5A). */
export const nutritionSchema = z.object({
  height: z.number().positive().optional(),
  currentWeight: z.number().positive().optional(),
  targetWeight: z.number().positive().optional(),
  foodPreferences: z.string().optional(),
  allergies: z.string().optional(),
  dislikedFoods: z.string().optional(),
  favoriteMeals: z.string().optional(),
  mealsPerDay: z.number().int().min(1).max(10).optional(),
  cookingAbility: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  groceryStores: z.string().optional(),
  budget: z.string().optional(),
  appliances: z.string().optional(),
  trackingPreference: z.enum(["detailed", "simple", "none"]).optional(),
  proteinTargetGrams: z.number().positive().optional(),
});

export type NutritionInput = z.infer<typeof nutritionSchema>;
