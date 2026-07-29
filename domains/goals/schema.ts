import { z } from "zod";

/** The domains a goal can attach to. "nutrition"/"recovery"/"learning" have
 * dedicated onboarding modules; the rest are broad life areas a goal can be
 * tagged with without a full module of their own. "general" stays last as
 * the catch-all for anything that doesn't fit. */
export const DOMAIN_KEYS = [
  "nutrition",
  "recovery",
  "learning",
  "health",
  "work",
  "finance",
  "family",
  "relationships",
  "school",
  "religious",
  "home",
  "social",
  "general",
] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number];

export const DOMAIN_LABELS: Record<DomainKey, string> = {
  nutrition: "Nutrition",
  recovery: "Recovery",
  learning: "Learning",
  health: "Health",
  work: "Work / Career",
  finance: "Finance",
  family: "Family",
  relationships: "Relationships",
  school: "School / Education",
  religious: "Religious / Spiritual",
  home: "Home / Household",
  social: "Social / Community",
  general: "General / Other",
};

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
