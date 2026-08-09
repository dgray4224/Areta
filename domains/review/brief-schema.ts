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
 * v2: adds headlineInsight/correlationNarrative/achievementNote (the
 * "eye-opening, cross-domain, self-referential" engine redesign) and
 * expectedMetric/expectedDirection on each proposed change (closed-loop
 * experiment tracking, CLAUDE.md §8) — see this feature's plan doc.
 */
export const weeklyBriefSchema = z.object({
  /** The single most eye-opening, specific finding this week — rendered
   * as the hero/lead, ahead of executiveSummary. Required (not optional)
   * so forced tool-use can't silently omit it the way an optional field
   * sometimes does. */
  headlineInsight: z.string(),
  executiveSummary: z.string(),
  /** Plain-language read of the strongest cross-domain correlation found
   * in this user's own multi-week history, or null if none was strong
   * enough to report (never invent one). */
  correlationNarrative: z.string().nullable(),
  /** Personal-best / streak / biggest-jump framing, or null if nothing
   * genuinely stands out this week (never manufacture praise). */
  achievementNote: z.string().nullable(),
  whatWorked: z.array(z.string()),
  whatNeedsImprovement: z.array(z.string()),
  progress: z.array(
    z.object({
      goalId: z.string(),
      status: z.enum(["ahead", "on_track", "at_risk", "insufficient_data"]),
      summary: z.string(),
      evidence: z.array(z.string()),
    })
  ),
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
  risks: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string(),
    })
  ),
  highestLeverageAction: z.string(),
  /** An id from the curated MOTIVATION_QUOTES bank (domains/motivation/quotes.ts)
   * — the model selects, it never generates the quote text itself, so a
   * fabricated or misattributed quote can't pass schema validation. */
  weeklyMottoId: z.enum(MOTIVATION_QUOTE_IDS),
});

export type WeeklyBrief = z.infer<typeof weeklyBriefSchema>;
