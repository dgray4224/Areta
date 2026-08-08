export type Exercise = {
  id: string;
  name: string;
  movementPattern: string;
  equipmentRequired: string[];
  archetypeTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  primaryMuscleGroups: string[];
  instructions: string | null;
  /** Goal-first enrichment (migration 0044 columns, backfilled in 0089)
   * -- what domains/recommendation/* filters and scores on. The legacy
   * generation path (generate.ts's archetype filtering) ignores these,
   * so adding them here is purely additive for existing callers. */
  movementPatterns: string[];
  modality: "resistance" | "aerobic" | "mobility" | "power" | null;
  limitationTags: string[];
  compound: boolean;
};

export type ExerciseStatus = "active" | "review" | "deprecated";
export type Modality = "resistance" | "aerobic" | "mobility" | "power";

/** The fuller row shape (migration 0044's enrichment columns) for the
 * admin content-management editor — kept separate from `Exercise` above
 * rather than extending it, since `Exercise` is consumed all over the
 * existing workout-generation code with object literals that only know
 * about the original lean fields; adding required fields there would
 * ripple everywhere for no benefit to those call sites. */
export type AdminExercise = Exercise & {
  canonicalName: string;
  aliases: string[];
  movementPatterns: string[];
  secondaryMuscleGroups: string[];
  modality: Modality | null;
  unilateral: boolean;
  compound: boolean;
  setupRequirements: string[];
  limitationTags: string[];
  contraindicationNotes: string | null;
  status: ExerciseStatus;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  /** Set only for exercises a trainer submitted while building a
   * program (migration 0075) — null for every pre-existing and
   * admin-authored row. */
  createdBy: string | null;
};
