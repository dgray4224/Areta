export type Exercise = {
  id: string;
  name: string;
  movementPattern: string;
  equipmentRequired: string[];
  archetypeTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  primaryMuscleGroups: string[];
  instructions: string | null;
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
};
