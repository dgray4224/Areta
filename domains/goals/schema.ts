import { z } from "zod";

/** The domains a goal can attach to in this Phase 1 build — matches the
 * onboarding modules that actually exist (nutrition/recovery/learning),
 * plus "general" for goals outside those (e.g. finance, career). */
export const DOMAIN_KEYS = ["nutrition", "recovery", "learning", "general"] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number];

export const goalSchema = z.object({
  domainKey: z.enum(DOMAIN_KEYS),
  outcome: z.string().min(1, "Describe the outcome you want"),
  why: z.string().optional(),
  targetDate: z.string().optional(),
  startingState: z.string().optional(),
  constraints: z.string().optional(),
  successCriteria: z.string().optional(),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().int().min(1).max(5),
  knownObstacles: z.string().optional(),
});

export const goalsStepSchema = z.object({
  goals: z.array(goalSchema).min(1, "Add at least one goal"),
});

export type Goal = z.infer<typeof goalSchema>;
export type GoalsStepInput = z.infer<typeof goalsStepSchema>;
