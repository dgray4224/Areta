import type { WeeklyMetrics } from "@/domains/review/metrics";
import type { WeeklyReviewAnswers } from "@/domains/review/schema";

export type WeeklyReviewContext = {
  weekStart: string;
  currentPhase: { name: string; mission: string | null } | null;
  activeGoals: {
    id: string;
    outcome: string;
    domain: string;
    targetDate: string | null;
    priority: number | null;
  }[];
  metrics: WeeklyMetrics;
  nutritionTargets: {
    calorieTarget: number | null;
    proteinTarget: number | null;
    expectedWeeklyRateLb: number | null;
  } | null;
  userAnswers: WeeklyReviewAnswers;
  previousWeekPriorities: string[];
};

/**
 * Weekly AI context builder (CLAUDE.md §9). Assembles only the compact,
 * purpose-built fields the weekly-brief prompt needs — never the full
 * database — so what actually reaches the model stays small and legible.
 */
export function buildWeeklyReviewContext(input: WeeklyReviewContext): WeeklyReviewContext {
  return input;
}
