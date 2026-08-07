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

export type TrainerMealProgramAssignmentStatus = "active" | "ended";

/** Mirrors domains/trainerprogram/types.ts#TrainerProgramAssignment,
 * minus 'paused' (dropped, see migration 0083's comment) and with no
 * currentPhaseName/currentWeekInPhase-computing calendar-projection
 * module to lean on -- nutrition has no calendar UI yet, so
 * domains/trainer/service.ts resolves those two fields with a small
 * local phase-arithmetic helper instead of a shared pure module. */
export type TrainerMealProgramAssignment = {
  id: string;
  programId: string;
  programName: string;
  trainerId: string;
  clientId: string;
  status: TrainerMealProgramAssignmentStatus;
  startsOn: string;
  endDate: string | null;
  goalOutcome: string | null;
  currentPhaseId: string | null;
  currentPhaseName: string | null;
  currentWeekInPhase: number | null;
  startedAt: string;
  endedAt: string | null;
};

/** One row in a client's meal-program assignment archive -- mirrors
 * domains/trainerprogram/types.ts#PastAssignment. */
export type PastMealAssignment = {
  id: string;
  programId: string;
  programName: string;
  startsOn: string;
  endDate: string | null;
  goalOutcome: string | null;
  startedAt: string;
  endedAt: string | null;
};

/** One row in the portion-review screen -- a program meal, its base
 * recipe macros, the live-computed recommendation, and whatever the
 * trainer has actually saved for this client so far (null until they
 * save at least once, per migration 0083's own "no row means not yet
 * tailored" comment). */
export type MealPortionRow = {
  programMealId: string;
  dayOfWeek: number;
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  baseCalories: number;
  baseProteinG: number;
  recommendedServings: number;
  savedServings: number | null;
};
