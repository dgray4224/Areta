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

/** Closed enum of `WeeklyMetrics` fields (domains/review/metrics.ts) a
 * goal can set a numeric target against, for the weekly-review engine's
 * goal-trajectory projection (domains/review/trajectory.ts). Deliberately
 * not a free-form/custom formula — never parsed out of `outcome`/
 * `successCriteria`'s free text. A goal that leaves these unset simply
 * never gets a trajectory card. Defined here (not in domains/review) since
 * goals is the more foundational domain — review depends on goals, not
 * the other way around. */
export const GOAL_TARGET_METRIC_TYPES = [
  "weight_lb",
  "calorie_adherence_pct",
  "protein_adherence_pct",
  "task_completion_pct",
  "learning_minutes_weekly",
] as const;
export type GoalTargetMetricType = (typeof GOAL_TARGET_METRIC_TYPES)[number];

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
  /** Optional numeric target — lets the weekly-review engine project a
   * trajectory against `targetDate`. All three must be set together for
   * a trajectory to be computed (enforced by the form UI, not this
   * schema, since partial input during typing is normal). */
  targetMetricType: z.enum(GOAL_TARGET_METRIC_TYPES).optional(),
  targetValue: z.number().optional(),
  targetDirection: z.enum(["increase", "decrease"]).optional(),
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

/** Post-onboarding goal-target set/edit flow (domains/goals/service.ts's
 * setGoalTarget). Mirrors goalSchema's target fields, but enforces the
 * "all three together, or all three cleared" rule server-side — unlike
 * the onboarding form, a direct API caller isn't bound by client-side UI
 * validation. */
export const goalTargetSchema = z
  .object({
    targetMetricType: z.enum(GOAL_TARGET_METRIC_TYPES).nullable(),
    targetValue: z.number().nullable(),
    targetDirection: z.enum(["increase", "decrease"]).nullable(),
  })
  .refine(
    (data) => {
      const allSet = data.targetMetricType !== null && data.targetValue !== null && data.targetDirection !== null;
      const allNull = data.targetMetricType === null && data.targetValue === null && data.targetDirection === null;
      return allSet || allNull;
    },
    { message: "Set a metric, value, and direction together, or clear all three." }
  );

export type GoalTargetInput = z.infer<typeof goalTargetSchema>;
