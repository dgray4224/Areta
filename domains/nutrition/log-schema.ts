import { z } from "zod";

/** A single food entry within a meal — distinct from nutrition/schema.ts,
 * which captures onboarding preferences, not daily log entries. */
export const nutritionLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  food: z.string().min(1, "Describe what you ate"),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbohydrates: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type NutritionLogInput = z.infer<typeof nutritionLogSchema>;
