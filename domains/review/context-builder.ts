import type { WeeklyMetrics } from "@/domains/review/metrics";
import { MOTIVATION_QUOTES } from "@/domains/motivation/quotes";

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
  recentMemories: { type: string; content: string; evidence: string | null }[];
  previousWeekPriorities: string[];
  motivationQuoteBank: { id: string; quote: string; author: string; themes: string[] }[];
};

/**
 * Weekly AI context builder (CLAUDE.md §9). Assembles only the compact,
 * purpose-built fields the weekly-brief prompt needs — never the full
 * database — so what actually reaches the model stays small and legible.
 * `motivationQuoteBank` is always the same curated constant, not
 * user-specific, so callers don't supply it — it's injected here.
 */
export function buildWeeklyReviewContext(
  input: Omit<WeeklyReviewContext, "motivationQuoteBank">
): WeeklyReviewContext {
  return { ...input, motivationQuoteBank: MOTIVATION_QUOTES };
}
