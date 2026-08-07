"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { requireTrainer } from "@/platform/auth/trainer";
import { logAdminAction } from "@/platform/audit/log";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { recipeSchema } from "@/domains/recipes/schema";
import {
  trainerMealProgramSchema,
  trainerMealProgramPhaseSchema,
  trainerMealProgramMealSchema,
} from "@/domains/trainermealprogram/schema";
import type {
  TrainerMealProgram,
  TrainerMealProgramPhase,
  TrainerMealProgramMeal,
  HydratedTrainerMealProgramPhase,
  TrainerMealProgramWithPhases,
} from "@/domains/trainermealprogram/types";
import type { Recipe } from "@/domains/recipes/types";

/** Every mutation here relies on RLS (migration 0083's owner_all
 * policies, each walking the FK chain back to
 * trainer_meal_programs.trainer_id = auth.uid()) to reject writes to
 * another trainer's program -- same convention as
 * domains/trainerprogram/service.ts, see that file's own comment. */

function toProgram(row: Database["public"]["Tables"]["trainer_meal_programs"]["Row"]): TrainerMealProgram {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    description: row.description,
    status: row.status as TrainerMealProgram["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPhase(row: Database["public"]["Tables"]["trainer_meal_program_phases"]["Row"]): TrainerMealProgramPhase {
  return {
    id: row.id,
    programId: row.program_id,
    phaseOrder: row.phase_order,
    name: row.name,
    focus: row.focus,
    lengthWeeks: row.length_weeks,
    isFinal: row.is_final,
  };
}

function toMeal(row: Database["public"]["Tables"]["trainer_meal_program_meals"]["Row"]): TrainerMealProgramMeal {
  return {
    id: row.id,
    phaseId: row.phase_id,
    dayOfWeek: row.day_of_week,
    mealType: row.meal_type as TrainerMealProgramMeal["mealType"],
    mealOrder: row.meal_order,
    recipeId: row.recipe_id,
  };
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function listMyMealPrograms(): Promise<TrainerMealProgramWithPhases[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  const { data: programRows, error } = await supabase
    .from("trainer_meal_programs")
    .select("*")
    .eq("trainer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load meal programs: ${error.message}`);

  const programIds = (programRows ?? []).map((p) => p.id);
  const { data: phaseRows } = programIds.length
    ? await supabase
        .from("trainer_meal_program_phases")
        .select("*")
        .in("program_id", programIds)
        .order("phase_order", { ascending: true })
    : { data: [] };

  const phasesByProgram = new Map<string, TrainerMealProgramPhase[]>();
  for (const row of phaseRows ?? []) {
    const list = phasesByProgram.get(row.program_id) ?? [];
    list.push(toPhase(row));
    phasesByProgram.set(row.program_id, list);
  }

  return (programRows ?? []).map((row) => ({
    ...toProgram(row),
    phases: phasesByProgram.get(row.id) ?? [],
  }));
}

export async function getMealProgramWithPhases(programId: string): Promise<TrainerMealProgramWithPhases | null> {
  const supabase = await createClient();
  const { data: programRow, error } = await supabase
    .from("trainer_meal_programs")
    .select("*")
    .eq("id", programId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load meal program: ${error.message}`);
  if (!programRow) return null;

  const { data: phaseRows } = await supabase
    .from("trainer_meal_program_phases")
    .select("*")
    .eq("program_id", programId)
    .order("phase_order", { ascending: true });

  return { ...toProgram(programRow), phases: (phaseRows ?? []).map(toPhase) };
}

export async function createMealProgram(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireTrainer();
  const parsed = trainerMealProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_meal_programs")
    .insert({ trainer_id: user.id, name: parsed.data.name, description: parsed.data.description || null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_meal_program_created",
    targetType: "trainer_meal_program",
    targetId: data.id,
    detail: { name: parsed.data.name },
  });

  return { ok: true, data: { id: data.id } };
}

export async function updateMealProgram(programId: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerMealProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_meal_programs")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", programId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** No delete function -- same retirement-via-status pattern as the
 * workout side: 'archived' takes a program out of the assignable list
 * without orphaning any assignment or materialized meal_plan_items that
 * already reference it. Leaving 'published' is refused while any client
 * has an active assignment, same reasoning as
 * domains/trainerprogram/service.ts#setProgramStatus. */
export async function setMealProgramStatus(
  programId: string,
  status: "draft" | "published" | "archived"
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (status !== "published") {
    const { count } = await supabase
      .from("trainer_meal_program_assignments")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("status", "active");
    if (count && count > 0) {
      return {
        ok: false,
        error: "A client is actively assigned to this program -- reassign or end that first.",
      };
    }
  }

  const { error } = await supabase.from("trainer_meal_programs").update({ status }).eq("id", programId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_meal_program_status_changed",
    targetType: "trainer_meal_program",
    targetId: programId,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export async function addPhase(programId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireTrainer();
  const parsed = trainerMealProgramPhaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: lastPhase } = await supabase
    .from("trainer_meal_program_phases")
    .select("phase_order")
    .eq("program_id", programId)
    .order("phase_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const phaseOrder = (lastPhase?.phase_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("trainer_meal_program_phases")
    .insert({
      program_id: programId,
      phase_order: phaseOrder,
      name: parsed.data.name,
      focus: parsed.data.focus || null,
      length_weeks: parsed.data.lengthWeeks,
      is_final: parsed.data.isFinal,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function updatePhase(phaseId: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerMealProgramPhaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_meal_program_phases")
    .update({
      name: parsed.data.name,
      focus: parsed.data.focus || null,
      length_weeks: parsed.data.lengthWeeks,
      is_final: parsed.data.isFinal,
    })
    .eq("id", phaseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Whether any already-materialized meal_plan_items still point at one
 * of these trainer_meal_program_meals ids -- same guard as the workout
 * side's hasMaterializedReferences (domains/trainerprogram/service.ts),
 * added defensively now even though nothing writes
 * meal_plan_items.trainer_meal_program_meal_id yet (materialization is
 * a later pass) -- the workout side found this guard missing in two
 * separate places across two code-review rounds, not worth risking the
 * same gap here a second time. */
async function hasMaterializedReferences(mealIds: string[], supabase: SupabaseClient<Database>): Promise<boolean> {
  if (mealIds.length === 0) return false;
  const { count } = await supabase
    .from("meal_plan_items")
    .select("id", { count: "exact", head: true })
    .in("trainer_meal_program_meal_id", mealIds);
  return (count ?? 0) > 0;
}

export async function deletePhase(phaseId: string): Promise<ActionResult> {
  await requireTrainer();
  const supabase = await createClient();

  const { data: mealRows } = await supabase
    .from("trainer_meal_program_meals")
    .select("id")
    .eq("phase_id", phaseId);
  const mealIds = (mealRows ?? []).map((m) => m.id);

  if (await hasMaterializedReferences(mealIds, supabase)) {
    return {
      ok: false,
      error: "A client already has a generated plan using content from this phase -- delete won't proceed.",
    };
  }

  const { error } = await supabase.from("trainer_meal_program_phases").delete().eq("id", phaseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Meals -- the leaf level (no session grouping, see types.ts's own
// comment): one recipe at one meal slot on one day within a phase.
// ---------------------------------------------------------------------------

export async function addMeal(phaseId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireTrainer();
  const parsed = trainerMealProgramMealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: lastMeal } = await supabase
    .from("trainer_meal_program_meals")
    .select("meal_order")
    .eq("phase_id", phaseId)
    .eq("day_of_week", parsed.data.dayOfWeek)
    .eq("meal_type", parsed.data.mealType)
    .order("meal_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mealOrder = (lastMeal?.meal_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("trainer_meal_program_meals")
    .insert({
      phase_id: phaseId,
      day_of_week: parsed.data.dayOfWeek,
      meal_type: parsed.data.mealType,
      meal_order: mealOrder,
      recipe_id: parsed.data.recipeId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function updateMeal(mealId: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerMealProgramMealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_meal_program_meals")
    .update({
      day_of_week: parsed.data.dayOfWeek,
      meal_type: parsed.data.mealType,
      recipe_id: parsed.data.recipeId,
    })
    .eq("id", mealId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Same materialized-reference guard as deletePhase. */
export async function deleteMeal(mealId: string): Promise<ActionResult> {
  await requireTrainer();
  const supabase = await createClient();

  if (await hasMaterializedReferences([mealId], supabase)) {
    return {
      ok: false,
      error: "A client already has a generated plan using this meal -- delete won't proceed.",
    };
  }

  const { error } = await supabase.from("trainer_meal_program_meals").delete().eq("id", mealId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Hydration -- for the builder UI (and, later, materialization)
// ---------------------------------------------------------------------------

export async function getPhaseHydrated(
  phaseId: string,
  client?: SupabaseClient<Database>
): Promise<HydratedTrainerMealProgramPhase | null> {
  const supabase = client ?? (await createClient());
  const { data: phaseRow, error: phaseError } = await supabase
    .from("trainer_meal_program_phases")
    .select("*")
    .eq("id", phaseId)
    .maybeSingle();
  if (phaseError) throw new Error(`Failed to load phase: ${phaseError.message}`);
  if (!phaseRow) return null;

  const { data: mealRows, error: mealError } = await supabase
    .from("trainer_meal_program_meals")
    .select("*")
    .eq("phase_id", phaseId)
    .order("day_of_week", { ascending: true })
    .order("meal_order", { ascending: true });
  if (mealError) throw new Error(`Failed to load meals: ${mealError.message}`);

  return { ...toPhase(phaseRow), meals: (mealRows ?? []).map(toMeal) };
}

// ---------------------------------------------------------------------------
// Recipes -- browse/create, scoped to what a trainer is allowed to use
// ---------------------------------------------------------------------------

function toRecipe(row: Database["public"]["Tables"]["recipes"]["Row"]): Recipe {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type as Recipe["mealType"],
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    dietaryTags: row.dietary_tags,
    ingredients: row.ingredients as unknown as Recipe["ingredients"],
    instructions: row.instructions,
    storageInstructions: row.storage_instructions,
    status: row.status as Recipe["status"],
  };
}

/** Active library recipes plus this trainer's own not-yet-reviewed
 * submissions -- mirrors getExercisesForTrainer exactly (domains/
 * trainerprogram/service.ts). */
export async function getRecipesForTrainer(): Promise<Recipe[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .or(`status.eq.active,created_by.eq.${user.id}`);
  if (error) throw new Error(`Failed to load recipes: ${error.message}`);
  return (data ?? []).map(toRecipe);
}

/** Full domains/recipes/schema.ts#recipeSchema, not a trimmed-down
 * trainer-specific shape -- see schema.ts's own comment for why (a
 * recipe's ingredients are load-bearing for grocery-list generation, so
 * there's no smaller "good enough for now" version). status is always
 * forced to 'review' server-side regardless of what's passed in. */
export async function createRecipeAsTrainer(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireTrainer();
  const parsed = recipeSchema.omit({ status: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      name: parsed.data.name,
      meal_type: parsed.data.mealType,
      calories: parsed.data.calories,
      protein_g: parsed.data.proteinG,
      carbs_g: parsed.data.carbsG,
      fat_g: parsed.data.fatG,
      fiber_g: parsed.data.fiberG ?? null,
      prep_minutes: parsed.data.prepMinutes,
      cook_minutes: parsed.data.cookMinutes,
      servings: parsed.data.servings,
      dietary_tags: parsed.data.dietaryTags,
      ingredients: parsed.data.ingredients,
      instructions: parsed.data.instructions,
      storage_instructions: parsed.data.storageInstructions || null,
      status: "review",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_recipe_submitted",
    targetType: "recipe",
    targetId: data.id,
    detail: { name: parsed.data.name },
  });

  return { ok: true, data: { id: data.id } };
}
