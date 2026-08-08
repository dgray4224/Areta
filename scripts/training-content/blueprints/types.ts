/**
 * Blueprint types for the goal-first template matrix generator
 * (scripts/training-content/generate-templates.ts). One authored
 * Blueprint per EXERCISE_GOAL expands into program_templates rows for
 * every (experience tier x equipment context x duration band) combo the
 * blueprint declares -- the "full matrix" is generated, never
 * hand-written row by row.
 *
 * Slot `pattern` values MUST come from the normalized movement-pattern
 * taxonomy backfilled onto exercises.movement_patterns in migration
 * 0089 -- that's the whole matching contract with the recommendation
 * engine (domains/recommendation/fill-slots.ts).
 */

export const TIERS = ["beginner", "intermediate", "advanced"] as const;
export type Tier = (typeof TIERS)[number];

export const BANDS = ["15_20", "30", "45", "60_plus"] as const;
export type Band = (typeof BANDS)[number];

/** Deliberately excludes "combination" -- users who train in mixed
 * locations are matched to the closest concrete-context template by
 * select-template.ts's relaxation (combination matches any context),
 * rather than duplicating every template a fifth time. */
export const CONTEXTS = ["home_no_equipment", "home_basic_equipment", "full_gym", "outdoors"] as const;
export type Context = (typeof CONTEXTS)[number];

export type SlotSpec = {
  label: string;
  /** Normalized movement-pattern token (see migration 0089's header). */
  pattern: string;
  modality: "resistance" | "aerobic" | "mobility" | "power";
  /** 1 = most essential. Shorter duration bands keep only the
   * lowest-priority-number slots (see BAND_SLOT_CAP). */
  priority: number;
  /** [min, max] sets -- the engine's RP-style ramp prescribes sets_min
   * at phase week 1 and +1/week up to sets_max (resistance slots). */
  sets?: [number, number];
  reps?: [number, number];
  effort?: string;
  restSeconds?: number;
  /** [min, max] minutes for aerobic slots at the 45-minute reference
   * band; other bands scale by BAND_MINUTES_FACTOR. */
  minutes?: [number, number];
  notes?: string;
};

export type SessionSpec = {
  name: string;
  /** template_sessions.session_type -- freeform ('strength',
   * 'conditioning', 'endurance', 'mixed'). */
  type: string;
  slots: SlotSpec[];
};

export type PhaseSpec = {
  name: string;
  focus: string;
  lengthWeeks: number;
  intensityStyle: string;
};

export type TierPlan = {
  /** [days_per_week_min, days_per_week_max] on the template row. When a
   * user's frequency exceeds the authored session count, the engine
   * cycles sessions across the week (same behavior as
   * materializeWorkoutPlan's session cycling). */
  days: [number, number];
  sessions: SessionSpec[];
};

export type Blueprint = {
  goal: string;
  slugBase: string;
  name: string;
  description: string;
  /** Two phases: base + final. The final phase's is_final=true tells
   * progression.ts to reselect a template once it completes (fresh
   * variety), mirroring rotation.ts's program_completed transition. */
  phases: [PhaseSpec, PhaseSpec];
  tiers: Record<Tier, TierPlan>;
  contexts: Context[];
  bands: Band[];
  /** Per-context pattern rewrites, e.g. home_no_equipment swapping
   * pull patterns (no bar/dumbbells assumed) for trainable substitutes. */
  contextSwap?: Partial<Record<Context, Record<string, string>>>;
};

/** Max slots per resistance/power session by duration band. */
export const BAND_SLOT_CAP: Record<Band, number> = {
  "15_20": 3,
  "30": 4,
  "45": 6,
  "60_plus": 8,
};

/** Aerobic slot minutes scale relative to the 45-minute reference. */
export const BAND_MINUTES_FACTOR: Record<Band, number> = {
  "15_20": 0.45,
  "30": 0.7,
  "45": 1,
  "60_plus": 1.4,
};

export const TIER_LABEL: Record<Tier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const CONTEXT_LABEL: Record<Context, string> = {
  home_no_equipment: "no equipment",
  home_basic_equipment: "home equipment",
  full_gym: "full gym",
  outdoors: "outdoors",
};

export const BAND_LABEL: Record<Band, string> = {
  "15_20": "15-20 min",
  "30": "~30 min",
  "45": "~45 min",
  "60_plus": "60+ min",
};

/** Standard swaps for a no-equipment context: patterns whose library
 * coverage requires equipment get rewritten to bodyweight-trainable
 * substitutes (pull patterns have zero bodyweight-only coverage in the
 * current library -- push-up/squat/bridge/core patterns are covered). */
export const NO_EQUIPMENT_SWAP: Record<string, string> = {
  horizontal_pull: "core_stability",
  vertical_pull: "core_stability",
  hinge: "hip_extension",
  elbow_flexion: "elbow_extension",
  chest_isolation: "horizontal_push",
  shoulder_isolation: "core_stability",
  quad_isolation: "squat",
  calf_raise: "core_stability",
  olympic_lift: "power",
  bike: "run",
  row: "run",
  swim: "run",
};
