/** Trainer-authored nutrition programs (2026-08-07) — the nutrition-side
 * counterpart to domains/trainerprogram/types.ts. Mirrors that shape
 * (program -> phases -> ...) with one structural simplification: no
 * session-grouping level, since a meal slot is already fully identified
 * by (dayOfWeek, mealType) -- see supabase/migrations/0083's own
 * comment for the full reasoning, including why portion size lives
 * per-client (domains/trainer/service.ts) rather than on the program. */

export type TrainerMealProgramStatus = "draft" | "published" | "archived";

export type TrainerMealProgram = {
  id: string;
  trainerId: string;
  name: string;
  description: string | null;
  status: TrainerMealProgramStatus;
  createdAt: string;
  updatedAt: string;
};

export type TrainerMealProgramPhase = {
  id: string;
  programId: string;
  phaseOrder: number;
  name: string;
  focus: string | null;
  lengthWeeks: number;
  isFinal: boolean;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type TrainerMealProgramMeal = {
  id: string;
  phaseId: string;
  dayOfWeek: number;
  mealType: MealType;
  mealOrder: number;
  recipeId: string;
};

/** A phase with its meals loaded, ready to display in the builder or
 * hand to a future materialization function. */
export type HydratedTrainerMealProgramPhase = TrainerMealProgramPhase & {
  meals: TrainerMealProgramMeal[];
};

/** A program with every phase (unhydrated -- meal detail loaded
 * separately per phase) for the builder's overview/outline view. */
export type TrainerMealProgramWithPhases = TrainerMealProgram & {
  phases: TrainerMealProgramPhase[];
};
