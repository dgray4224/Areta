/**
 * The goal-first workout recommendation engine ("Phase 4" in 0044's
 * comments, finally real). Pure logic lives in select-template.ts /
 * fill-slots.ts / prescribe.ts / progression.ts; service.ts is the only
 * I/O entry point. This file is a plain module (no "use server") so it
 * can export types and constants — see the 2026-08-07 production
 * incident: "use server" files may only export async functions.
 */
import type { ExerciseGoal, RecentExperienceLevel, TrainingLocation, SessionDurationBand, DaysPerWeekOption } from "@/domains/exercise/schema";

export type ExperienceTier = "beginner" | "intermediate" | "advanced";

/** 4-tier onboarding answer -> 3-tier template key. "occasional" maps
 * down to beginner deliberately (conservative default, same instinct as
 * exercise-calc.ts's assumed-beginner fallback). */
export const EXPERIENCE_TO_TIER: Record<RecentExperienceLevel, ExperienceTier> = {
  new_or_returning: "beginner",
  occasional: "beginner",
  consistent: "intermediate",
  highly_experienced: "advanced",
};

export const DAYS_PER_WEEK_VALUE: Record<DaysPerWeekOption, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5_plus": 5,
};

/** Aerobic movement patterns are an interchangeable group: a slot
 * authored as `run` can be filled with a bike/swim/row exercise when
 * the user's stated activity preference (preferredActivities /
 * goalDetail.preferredEnduranceActivity / eventType) points there. */
export const AEROBIC_PATTERN_GROUP = ["run", "bike", "swim", "row"] as const;

/** onboarding preferredActivities token -> the aerobic pattern it maps
 * to (strength/mobility tokens don't re-target aerobic slots). */
export const ACTIVITY_TO_PATTERN: Record<string, string> = {
  running: "run",
  cycling: "bike",
  swimming: "swim",
  walking: "run",
  interval_training: "conditioning",
};

// ---------------------------------------------------------------------------
// DB row views (camelCase), loaded by service.ts
// ---------------------------------------------------------------------------

export type ProgramTemplate = {
  id: string;
  slug: string;
  name: string;
  goal: ExerciseGoal;
  experienceTier: ExperienceTier;
  daysPerWeekMin: number;
  daysPerWeekMax: number;
  sessionDurationBand: SessionDurationBand;
  equipmentContext: TrainingLocation;
};

export type TemplatePhase = {
  id: string;
  templateId: string;
  phaseOrder: number;
  name: string;
  focus: string | null;
  lengthWeeks: number;
  intensityStyle: string | null;
  isFinal: boolean;
};

export type TemplateSlot = {
  id: string;
  sessionId: string;
  slotOrder: number;
  slotLabel: string;
  movementPattern: string;
  modality: "resistance" | "aerobic" | "mobility" | "power";
  setsMin: number | null;
  setsMax: number | null;
  repsMin: number | null;
  repsMax: number | null;
  effortTarget: string | null;
  restSeconds: number | null;
  durationMinutesMin: number | null;
  durationMinutesMax: number | null;
  coachingNotes: string | null;
};

export type TemplateSession = {
  id: string;
  phaseId: string;
  sessionIndex: number;
  name: string;
  sessionType: string | null;
  slots: TemplateSlot[];
};

export type HydratedTemplatePhase = TemplatePhase & { sessions: TemplateSession[] };

export type LimitationRule = {
  limitationTag: string;
  action: "exclude" | "substitute" | "manual_review";
  movementPattern: string | null;
  substituteMovementPattern: string | null;
  rationale: string;
};

// ---------------------------------------------------------------------------
// Engine output shapes
// ---------------------------------------------------------------------------

/** Honest per-item attribution written to workout_plan_items.provenance. */
export type ItemProvenance = {
  templateSlotId: string;
  slotLabel: string;
  score: number;
  scoreBreakdown: Record<string, number>;
  claimIds: string[];
  relaxations: string[];
};

export type SlotAlternative = {
  exerciseId: string;
  rank: 1 | 2;
  score: number;
};

export type FilledSlot = {
  slot: TemplateSlot;
  exerciseId: string;
  provenance: ItemProvenance;
  alternatives: SlotAlternative[];
};

export type TemplateProgressionDecision =
  | { kind: "select_new_template"; reason: "no_history" | "inputs_changed" | "long_gap" | "template_completed" }
  | { kind: "continue_phase"; templateId: string; phaseId: string; weekNumber: number }
  | { kind: "advance_phase"; templateId: string; phaseId: string };
