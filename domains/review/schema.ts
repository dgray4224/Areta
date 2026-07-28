import { z } from "zod";

/** CLAUDE.md Phase 4 "Ask the user" — five to eight questions, all
 * optional so a thin review is still submittable. */
export const weeklyReviewAnswersSchema = z.object({
  wentWell: z.string().optional(),
  difficult: z.string().optional(),
  unrealistic: z.string().optional(),
  mealsToKeep: z.string().optional(),
  mealsToDrop: z.string().optional(),
  missedTaskCauses: z.string().optional(),
  whatShouldChange: z.string().optional(),
  scheduleChanges: z.string().optional(),
});

export type WeeklyReviewAnswers = z.infer<typeof weeklyReviewAnswersSchema>;
