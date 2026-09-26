/**
 * "Generate a workout today" -- the on-demand path.
 *
 * The template engine plans a *week* from a user's goal. This plans one
 * session, right now, from a body part the user just tapped. It exists
 * because the honest answer to "I want to train shoulders today" was
 * previously "wait for Sunday".
 *
 * Three options, not one: a single generated workout is a coin flip the
 * user has to accept or abandon, whereas three lets them choose without
 * feeling overridden. The options differ in *shape* (heavy and slow vs
 * a quick circuit), not just in which exercises came up, so the choice
 * carries real information.
 *
 * The safety floor is the shared one (buildSafetyFilter) -- this path
 * can relax equipment and muscle targeting, but never injury rules or
 * the beginner guard.
 *
 * Pure module: no I/O, no "use server". The caller loads exercises,
 * limitation rules and recent-use counts.
 */
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { Exercise } from "@/domains/exerciselibrary/types";
import { buildSafetyFilter } from "@/domains/recommendation/safety";
import { stableHash } from "@/domains/recommendation/select-template";
import type { ExperienceTier, LimitationRule } from "@/domains/recommendation/types";
import { hasEquipment } from "@/domains/workoutplan/generate";
import { estimateSessionMinutes } from "@/domains/workoutplan/session-estimate";

// ---------------------------------------------------------------------------
// The question we ask the user
// ---------------------------------------------------------------------------

export const TODAY_FOCUSES = ["full_body", "upper_body", "lower_body", "core", "cardio"] as const;
export type TodayFocus = (typeof TODAY_FOCUSES)[number];

export const FOCUS_LABELS: Record<TodayFocus, string> = {
  full_body: "Full body",
  upper_body: "Upper body",
  lower_body: "Lower body",
  core: "Core",
  cardio: "Cardio",
};

/** Plain-language subtitle for each choice, so the prompt reads like a
 * coach asking rather than a filter UI. */
export const FOCUS_DESCRIPTIONS: Record<TodayFocus, string> = {
  full_body: "A bit of everything",
  upper_body: "Chest, back, shoulders and arms",
  lower_body: "Legs and glutes",
  core: "Abs and trunk",
  cardio: "Get your heart rate up",
};

/** Every muscle group that counts as "on topic" for a focus. Used for
 * the widened pool when an exact bucket can't be filled. */
const FOCUS_MUSCLES: Record<TodayFocus, string[]> = {
  upper_body: ["chest", "back", "shoulders", "arms", "biceps", "triceps", "grip"],
  lower_body: ["quads", "hamstrings", "glutes", "calves", "legs"],
  core: ["core"],
  cardio: ["cardio"],
  full_body: [
    "chest", "back", "shoulders", "arms", "biceps", "triceps",
    "quads", "hamstrings", "glutes", "calves", "legs", "core", "full body",
  ],
};

/**
 * Per-slot muscle buckets, in order. Slot N draws from ring[N % len].
 *
 * This is what stops "upper body" returning five variations of a chest
 * press: the ring walks the region so a session covers it. Ordering is
 * deliberate -- the big compound areas come first, while the user is
 * fresh, and arms/core land last.
 */
const FOCUS_SLOT_RING: Record<TodayFocus, string[][]> = {
  upper_body: [
    ["chest"],
    ["back"],
    ["shoulders"],
    ["back", "biceps", "arms"],
    ["chest", "triceps", "arms"],
    ["core"],
  ],
  lower_body: [
    ["quads", "legs"],
    ["glutes"],
    ["hamstrings"],
    ["quads", "legs", "glutes"],
    ["calves"],
    ["core"],
  ],
  core: [["core"]],
  cardio: [["cardio"]],
  full_body: [
    ["quads", "legs", "glutes"],
    ["chest", "shoulders"],
    ["back"],
    ["hamstrings", "glutes"],
    ["core"],
    ["arms", "biceps", "triceps"],
  ],
};

// ---------------------------------------------------------------------------
// The three shapes
// ---------------------------------------------------------------------------

type Variant = {
  key: string;
  /** Suffix appended to the focus label, e.g. "Upper body strength". */
  nameSuffix: string;
  /** One line telling the user what they're choosing between. */
  blurb: string;
  exerciseCount: number;
  sets: number;
  reps: number;
  restSeconds: number;
  /** Bias the early slots toward multi-joint work. */
  preferCompound: boolean;
};

const RESISTANCE_VARIANTS: Variant[] = [
  {
    key: "strength",
    nameSuffix: "strength",
    blurb: "Heavier sets with real rest between them",
    exerciseCount: 5,
    sets: 4,
    reps: 8,
    restSeconds: 90,
    preferCompound: true,
  },
  {
    key: "circuit",
    nameSuffix: "circuit",
    blurb: "More exercises, lighter, keep moving",
    exerciseCount: 6,
    sets: 3,
    reps: 14,
    restSeconds: 45,
    preferCompound: false,
  },
  {
    key: "quick",
    nameSuffix: "quick session",
    blurb: "Three exercises when time is short",
    exerciseCount: 3,
    sets: 3,
    reps: 12,
    restSeconds: 60,
    preferCompound: true,
  },
];

type CardioVariant = {
  key: string;
  nameSuffix: string;
  blurb: string;
  exerciseCount: number;
  durationMinutes: number;
};

const CARDIO_VARIANTS: CardioVariant[] = [
  {
    key: "steady",
    nameSuffix: "steady",
    blurb: "One effort, held at a conversational pace",
    exerciseCount: 1,
    durationMinutes: 30,
  },
  {
    key: "intervals",
    nameSuffix: "intervals",
    blurb: "Hard efforts with recovery between them",
    exerciseCount: 2,
    durationMinutes: 20,
  },
  {
    key: "quick",
    nameSuffix: "quick session",
    blurb: "Fifteen minutes, in and out",
    exerciseCount: 1,
    durationMinutes: 15,
  },
];

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type TodayWorkoutExercise = {
  exerciseId: string;
  name: string;
  order: number;
  sets: number | null;
  reps: number | null;
  restSeconds: number | null;
  durationMinutes: number | null;
};

export type TodayWorkoutOption = {
  /** Stable within one generate call; the client echoes it back to pick. */
  key: string;
  name: string;
  blurb: string;
  estimatedMinutes: number | null;
  exercises: TodayWorkoutExercise[];
  /** Compromises worth admitting to the user, e.g. equipment widening. */
  warnings: string[];
};

export type GenerateTodayInput = {
  userId: string;
  focus: TodayFocus;
  tier: ExperienceTier;
  exercises: Exercise[];
  exercise: ExerciseInput;
  limitationRules: LimitationRule[];
  /** exercise_id -> times used in recent weeks (variety down-ranking). */
  recentUseCounts: Map<string, number>;
};

export type GenerateTodayResult = {
  options: TodayWorkoutOption[];
  /** Set when the library could not honour the request at all. */
  warnings: string[];
};

const TIER_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function generateTodayWorkouts(input: GenerateTodayInput): GenerateTodayResult {
  const warnings: string[] = [];
  const { isSafe, activeRules } = buildSafetyFilter(input.exercise, input.limitationRules, input.tier);

  const safe = input.exercises.filter(isSafe);
  if (safe.length === 0) {
    return {
      options: [],
      warnings: [
        "No exercise in the library clears the limitations on your profile. Review them in Settings, or pick an exercise yourself.",
      ],
    };
  }

  const equipmentAccess = input.exercise.equipmentAccess ?? [];
  const focusMuscles = new Set(FOCUS_MUSCLES[input.focus]);
  const isCardio = input.focus === "cardio";

  /** On-topic for the chosen focus, by muscle group or (for cardio) by
   * modality -- a rower is aerobic whatever its muscle tags say. */
  const onFocus = safe.filter((e) => {
    if (isCardio) return e.modality === "aerobic" || e.primaryMuscleGroups.includes("cardio");
    return e.primaryMuscleGroups.some((m) => focusMuscles.has(m));
  });

  if (onFocus.length === 0) {
    return {
      options: [],
      warnings: [
        `Nothing in the library matches ${FOCUS_LABELS[input.focus].toLowerCase()} within your limitations. Try another focus.`,
      ],
    };
  }

  // Exercises already spent on an earlier option, so the three don't
  // converge on the same five best-scoring movements.
  const usedAcrossOptions = new Map<string, number>();
  const options: TodayWorkoutOption[] = [];

  const variants: (Variant | CardioVariant)[] = isCardio ? CARDIO_VARIANTS : RESISTANCE_VARIANTS;

  for (const variant of variants) {
    const built = buildOption({
      variant,
      input,
      safe,
      onFocus,
      equipmentAccess,
      usedAcrossOptions,
      isCardio,
    });
    if (built.exercises.length > 0) {
      options.push(built);
      for (const ex of built.exercises) {
        usedAcrossOptions.set(ex.exerciseId, (usedAcrossOptions.get(ex.exerciseId) ?? 0) + 1);
      }
    }
  }

  if (options.length === 0) {
    warnings.push("Couldn't put a session together from the library. Pick an exercise yourself, or try another focus.");
  }

  for (const rule of activeRules.filter((r) => r.action === "manual_review")) {
    warnings.push(`Heads up: ${rule.rationale}`);
  }

  return { options, warnings };
}

function isCardioVariant(v: Variant | CardioVariant): v is CardioVariant {
  return "durationMinutes" in v;
}

function buildOption(args: {
  variant: Variant | CardioVariant;
  input: GenerateTodayInput;
  safe: Exercise[];
  onFocus: Exercise[];
  equipmentAccess: string[];
  usedAcrossOptions: Map<string, number>;
  isCardio: boolean;
}): TodayWorkoutOption {
  const { variant, input, safe, onFocus, equipmentAccess, usedAcrossOptions, isCardio } = args;
  const ring = FOCUS_SLOT_RING[input.focus];
  const chosen: TodayWorkoutExercise[] = [];
  const usedHere = new Set<string>();
  const optionWarnings: string[] = [];
  let widenedEquipment = false;

  for (let slot = 0; slot < variant.exerciseCount; slot++) {
    const bucket = new Set(ring[slot % ring.length]);

    // Relaxation ladder. Every rung is drawn from `safe` or `onFocus`,
    // both of which already passed the safety floor.
    const withEquipment = (pool: Exercise[]) => pool.filter((e) => hasEquipment(e, equipmentAccess));

    const inBucket = onFocus.filter((e) => e.primaryMuscleGroups.some((m) => bucket.has(m)));

    let pool = withEquipment(inBucket);
    if (pool.length === 0) {
      pool = withEquipment(onFocus);
    }
    if (pool.length === 0) {
      // Equipment is the only thing left to give. Say so once.
      pool = inBucket.length > 0 ? inBucket : onFocus;
      if (pool.length > 0 && !widenedEquipment) {
        widenedEquipment = true;
        optionWarnings.push(
          "Some of these need equipment you haven't listed — swap anything you can't do, or update your equipment in Settings."
        );
      }
    }
    if (pool.length === 0) pool = withEquipment(safe);
    if (pool.length === 0) break;

    // Nothing left that isn't already in this session. A short honest
    // session beats one that lists the same movement twice, which reads
    // as a bug to the person holding the phone.
    const candidates = pool.filter((e) => !usedHere.has(e.id));
    if (candidates.length === 0) break;

    const winner = candidates
      .map((e) => ({ e, score: scoreExercise({ e, slot, bucket, variant, input, usedAcrossOptions, isCardio }) }))
      .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id))[0].e;

    usedHere.add(winner.id);
    chosen.push({
      exerciseId: winner.id,
      name: winner.name,
      order: slot + 1,
      sets: isCardioVariant(variant) ? null : variant.sets,
      reps: isCardioVariant(variant) ? null : variant.reps,
      restSeconds: isCardioVariant(variant) ? null : variant.restSeconds,
      durationMinutes: isCardioVariant(variant)
        ? Math.max(5, Math.round(variant.durationMinutes / variant.exerciseCount))
        : null,
    });
  }

  const estimatedMinutes = estimateSessionMinutes(
    chosen.map((c) => ({
      durationMinutes: c.durationMinutes,
      sets: c.sets,
      reps: c.reps,
      restSeconds: c.restSeconds,
    }))
  );

  return {
    key: variant.key,
    name: `${FOCUS_LABELS[input.focus]} ${variant.nameSuffix}`,
    blurb: variant.blurb,
    estimatedMinutes,
    exercises: chosen,
    warnings: optionWarnings,
  };
}

function scoreExercise(args: {
  e: Exercise;
  slot: number;
  bucket: Set<string>;
  variant: Variant | CardioVariant;
  input: GenerateTodayInput;
  usedAcrossOptions: Map<string, number>;
  isCardio: boolean;
}): number {
  const { e, slot, bucket, variant, input, usedAcrossOptions, isCardio } = args;
  let score = 0;

  // On the bucket this slot asked for.
  score += e.primaryMuscleGroups.some((m) => bucket.has(m)) ? 50 : 0;

  // Compound movements first, while the user is fresh.
  if (!isCardioVariant(variant) && variant.preferCompound && slot <= 1 && e.compound) score += 20;
  // A circuit wants the opposite: shorter, simpler movements.
  if (!isCardioVariant(variant) && !variant.preferCompound && !e.compound) score += 10;

  if (isCardio && e.modality === "aerobic") score += 25;

  // Difficulty fit: exact tier best, one step away acceptable.
  const gap = Math.abs((TIER_ORDER[e.difficulty] ?? 0) - (TIER_ORDER[input.tier] ?? 0));
  score += gap === 0 ? 20 : gap === 1 ? 10 : 0;

  // Variety against what they've actually been doing lately.
  score -= 15 * (input.recentUseCounts.get(e.id) ?? 0);

  // Keep the three options from converging.
  score -= 60 * (usedAcrossOptions.get(e.id) ?? 0);

  // Stable per-user jitter so two users with identical profiles don't
  // get byte-identical workouts, and the same user gets the same three
  // options if they back out and tap again.
  score += stableHash(`${input.userId}:${input.focus}:${variant.key}:${slot}:${e.id}`) % 8;

  return score;
}
