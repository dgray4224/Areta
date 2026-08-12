import { z } from "zod";
import { MOTIVATION_QUOTE_IDS } from "@/domains/motivation/quotes";
import { EXPECTED_METRIC_KEYS } from "@/domains/review/experiments";

/**
 * The AI-generated portion of CLAUDE.md §10's WeeklyOperatingBrief.
 * Deliberately narrower than the full spec type: currentPhase is passed
 * through from real data (never AI-invented), and mealPlan/groceryList/
 * prepPlan are produced by Phase 3's deterministic generators, not asked
 * of the model (CLAUDE.md rule 6 — deterministic code for calculations,
 * AI only for interpretation/generation of the qualitative narrative).
 * Recovery plan, learning plan, appointments, and daily schedule
 * generation aren't built yet — see README known gaps.
 *
 * v3 (2026-08-12): collapsed from 8 separate structured fields
 * (headlineInsight/executiveSummary/correlationNarrative/achievementNote/
 * whatWorked/whatNeedsImprovement/progress/risks) down to `narrative` --
 * flowing paragraph prose reads as a coach talking to you, not a stitched-
 * together report. Verified before cutting each field that nothing outside
 * the UI reads it: only `priorities` (rolls into next week's
 * weekly_outcomes, domains/review/approve-flow.ts) and `changes` (creates
 * `recommendations` rows, domains/review/service.ts) are load-bearing --
 * everything else was pure display, safe to fold into prose.
 */
export const weeklyBriefSchema = z.object({
  /** 2-3 short paragraphs of flowing prose, no bullet lists. Supports a
   * markdown-lite subset only: **bold** for the one standout number/
   * finding per paragraph, *italic* for secondary emphasis -- rendered by
   * platform/ui/RichText.tsx (web) / lib/ui/RichText.tsx (mobile), which
   * only parse those two markers. Paragraph 1 must lead with the single
   * most non-obvious, goal-tied insight in the data (see
   * WEEKLY_BRIEF_INSTRUCTIONS for exactly what "non-obvious" means here).
   * Required min 2 (not optional/nullable) so forced tool-use can't
   * silently collapse this to nothing. */
  narrative: z.array(z.string()).min(2).max(3),
  priorities: z
    .array(
      z.object({
        title: z.string(),
        reason: z.string(),
        domain: z.string(),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      })
    )
    .max(3),
  changes: z.array(
    z.object({
      field: z.string(),
      previousValue: z.union([z.string(), z.number(), z.null()]),
      proposedValue: z.union([z.string(), z.number(), z.null()]),
      reason: z.string(),
      // Forced tool-use occasionally omits this on one or more array items
      // even when instructed to include it — it's informational, not
      // safety-critical (unlike the numeric parameters the engine itself
      // computes), so a sensible default beats failing the whole brief.
      confidence: z.number().min(0).max(1).optional().default(0.7),
      /** Turns this change into a falsifiable one-week hypothesis that
       * next week's brief checks against the real measured outcome
       * (domains/review/experiments.ts). Optional — not every change maps
       * cleanly onto one deterministic metric; an unset pair just means
       * this recommendation is never evaluated. */
      expectedMetric: z.enum(EXPECTED_METRIC_KEYS).optional(),
      expectedDirection: z.enum(["increase", "decrease", "improve", "stabilize"]).optional(),
    })
  ),
  /** One bolded-in-UI capstone sentence — the single concrete thing to do
   * about the narrative's insight. Must add something beyond the last
   * narrative paragraph, not restate it. May use the same bold/italic
   * markdown-lite markers as `narrative`. */
  highestLeverageAction: z.string(),
  /** An id from the curated MOTIVATION_QUOTES bank (domains/motivation/quotes.ts)
   * — the model selects, it never generates the quote text itself, so a
   * fabricated or misattributed quote can't pass schema validation. */
  weeklyMottoId: z.enum(MOTIVATION_QUOTE_IDS),
});

export type WeeklyBrief = z.infer<typeof weeklyBriefSchema>;
