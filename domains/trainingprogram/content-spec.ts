import { z } from "zod";
import { EXERCISE_ARCHETYPES, EXPERIENCE_LEVELS } from "@/domains/exercise/schema";

/**
 * Typed format for hand-drafting new training_programs content (see
 * docs/training-content-pipeline.md), replacing the hand-written SQL
 * tuples `0032`-`0040` were authored as -- that approach let a
 * cardio-shaped row's values silently drift out of sync with a
 * strength-shaped column list, a bug Postgres only caught at `db push`
 * time. Here a cardio-shaped prescription cannot be constructed with
 * strength fields (or vice versa): the discriminated union on `kind`
 * makes that shape mismatch a compile-time/parse-time error instead of a
 * runtime SQL error. scripts/training-content/generate-migration.ts maps
 * each variant to the correct SQL positionally, from a validated object,
 * never from a hand-typed tuple.
 *
 * Deliberately pure -- no "use server", no platform/supabase/server
 * import -- so both the app and scripts/training-content/*.ts (which run
 * outside Next's bundler via plain tsx) can import this directly.
 */

export const sourceSchema = z.object({
  organization: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  retrievedAt: z.iso.date(),
});
export type ContentSource = z.infer<typeof sourceSchema>;

const strengthFieldsSchema = z.object({
  kind: z.literal("strength"),
  /** An existing exercise's exact name, or a `refKey` from this batch's
   * `newExercises`. Resolved by scripts/training-content/validate-spec.ts. */
  exerciseRef: z.string().min(1),
  sets: z.number().int().positive(),
  repsMin: z.number().int().positive(),
  repsMax: z.number().int().positive(),
  intensityType: z.enum(["percent_1rm", "rpe", "none"]),
  intensityValue: z.string().min(1).optional(),
  coachingNotes: z.string().min(1).optional(),
});

const cardioFieldsSchema = z.object({
  kind: z.literal("cardio"),
  exerciseRef: z.string().min(1),
  /** Round count for interval-style cardio (e.g. "8 x 1 min hard, 1 min
   * easy" -> sets: 8) -- omit for a single continuous block. */
  sets: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive(),
  cardioIntensity: z.string().min(1),
  coachingNotes: z.string().min(1).optional(),
});

/** Same shape as a prescription, minus `alternates` itself -- an
 * alternate can't have its own alternates. Kept as its own type (not a
 * recursive reuse of prescriptionSchema) specifically to rule that out
 * at the schema level rather than by convention. */
export const alternateSpecSchema = z.discriminatedUnion("kind", [strengthFieldsSchema, cardioFieldsSchema]);
export type AlternateSpec = z.infer<typeof alternateSpecSchema>;

/** Up to 2 same-training-purpose swaps a user can pick instead of the
 * recommended exercise (e.g. rowing intervals -> swimming or biking
 * intervals) -- see docs/training-content-pipeline.md. No kind-matching
 * requirement against the primary; author judgment decides what counts
 * as an equivalent swap. */
const alternatesField = z.array(alternateSpecSchema).max(2).optional();

const strengthPrescriptionSchema = strengthFieldsSchema.extend({ alternates: alternatesField });
const cardioPrescriptionSchema = cardioFieldsSchema.extend({ alternates: alternatesField });

export const prescriptionSchema = z.discriminatedUnion("kind", [
  strengthPrescriptionSchema,
  cardioPrescriptionSchema,
]);
export type PrescriptionSpec = z.infer<typeof prescriptionSchema>;

export const newExerciseSchema = z.object({
  /** Batch-local key prescriptions reference via `exerciseRef` -- not
   * persisted, just how this spec wires a new exercise to the sessions
   * that use it before it has a real DB id. */
  refKey: z.string().min(1),
  name: z.string().min(1),
  movementPattern: z.string().min(1),
  equipmentRequired: z.array(z.string()).default([]),
  archetypeTags: z.array(z.enum(EXERCISE_ARCHETYPES)).min(1),
  difficulty: z.enum(EXPERIENCE_LEVELS),
  primaryMuscleGroups: z.array(z.string()).default([]),
  instructions: z.string().min(1).optional(),
});
export type NewExerciseSpec = z.infer<typeof newExerciseSchema>;

const sessionSpecSchema = z.object({
  name: z.string().min(1).optional(),
  sessionType: z.string().min(1).optional(),
  exercises: z.array(prescriptionSchema).min(1),
});

const phaseSpecSchema = z.object({
  name: z.string().min(1),
  focus: z.string().min(1).optional(),
  lengthWeeks: z.number().int().positive(),
  intensityStyle: z.string().min(1).optional(),
  isFinal: z.boolean(),
  sessions: z.array(sessionSpecSchema).min(1),
});

export const programSpecSchema = z.object({
  archetype: z.enum(EXERCISE_ARCHETYPES),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  methodologyNote: z.string().min(1).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  sessionsPerWeekMin: z.number().int().min(1).max(7),
  sessionsPerWeekMax: z.number().int().min(1).max(7),
  equipmentRequired: z.array(z.string()).default([]),
  displayOrder: z.number().int().default(0),
  /** Order in this array is authoritative -- phase_order/session_index/
   * exercise_order are all derived from array position, so they can't
   * drift out of sync the way a hand-typed `phase_order` integer could. */
  phases: z.array(phaseSpecSchema).min(1),
  /** Every program needs at least one credible, verifiable citation --
   * scripts/training-content/verify-sources.ts is what actually confirms
   * these are real and allowlisted; this schema only enforces the shape. */
  sources: z.array(sourceSchema).min(1),
});
export type ProgramSpec = z.infer<typeof programSpecSchema>;

export const contentBatchSchema = z.object({
  /** Shared across every program in this batch -- mirrors how `0032`-
   * `0040` already share exercises across the programs within one
   * archetype's migration file. */
  newExercises: z.array(newExerciseSchema).default([]),
  programs: z.array(programSpecSchema).min(1),
});
export type ContentBatch = z.infer<typeof contentBatchSchema>;
