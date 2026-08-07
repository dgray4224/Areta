import { z } from "zod";

export const trainerMealProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type TrainerMealProgramInput = z.infer<typeof trainerMealProgramSchema>;

export const trainerMealProgramPhaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  focus: z.string().optional(),
  lengthWeeks: z.number().int().min(1, "Must run at least 1 week").max(52),
  isFinal: z.boolean(),
});
export type TrainerMealProgramPhaseInput = z.infer<typeof trainerMealProgramPhaseSchema>;

export const trainerMealProgramMealSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  recipeId: z.string().uuid("Choose a recipe"),
});
export type TrainerMealProgramMealInput = z.infer<typeof trainerMealProgramMealSchema>;

/** A trainer adding a brand-new recipe while building a meal program
 * (status is always forced to 'review' server-side, not accepted from
 * the client -- see createRecipeAsTrainer). Reuses the full
 * domains/recipes/schema.ts#recipeSchema shape (unlike the trainer
 * exercise schema, which is deliberately a smaller field set than the
 * admin editor) -- a recipe's ingredients/instructions/macros are all
 * load-bearing for grocery-list generation and Sunday prep once this
 * cascades into meal_plans, so there's no smaller "good enough for now"
 * version the way an exercise's prescription fields have one. */
