import { z } from "zod";

/**
 * The AI-generated portion of CLAUDE.md §10's WeeklyOperatingBrief.
 * Deliberately narrower than the full spec type: currentPhase is passed
 * through from real data (never AI-invented), and mealPlan/groceryList/
 * prepPlan are produced by Phase 3's deterministic generators, not asked
 * of the model (CLAUDE.md rule 6 — deterministic code for calculations,
 * AI only for interpretation/generation of the qualitative narrative).
 * Recovery plan, learning plan, appointments, and daily schedule
 * generation aren't built yet — see README known gaps.
 */
export const weeklyBriefSchema = z.object({
  executiveSummary: z.string(),
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
});

export type WeeklyBrief = z.infer<typeof weeklyBriefSchema>;
