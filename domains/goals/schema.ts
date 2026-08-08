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
  "exercise",
  "sleep",
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
  exercise: "Exercise",
  sleep: "Sleep",
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

/** Areta V1 scope is health-only (CLAUDE.md is being narrowed for this
 * phase) — the Goals step only offers this list, not the full DOMAIN_KEYS.
 * Picking "Health" unconditionally unlocks the Nutrition/Exercise/Sleep
 * onboarding steps (see effectiveSteps in domains/onboarding/transform.ts).
 * Swapping this list is all a future phase needs to reintroduce
 * fine-grained categories or other life areas — no data model change. */
export const V1_DOMAIN_KEYS: readonly DomainKey[] = ["health"];

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

/** Goals became skippable in the 2026-08-07 onboarding consolidation —
 * an empty array is a valid submission (e.g. a trainer signing up to
 * coach, not to be coached). transformOnboarding already has a
 * no-goals mission fallback, and V1's health domains no longer derive
 * from picking a goal (see deriveActiveDomains). */
export const goalsStepSchema = z.object({
  goals: z.array(goalSchema),
});

export type Goal = z.infer<typeof goalSchema>;
export type GoalsStepInput = z.infer<typeof goalsStepSchema>;
