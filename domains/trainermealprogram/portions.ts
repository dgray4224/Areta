import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { recommendServings } from "@/domains/trainermealprogram/portion-recommendation";
import type { MealPortionRow } from "@/domains/trainermealprogram/types";
import type { ProjectedMealDay } from "@/domains/trainermealprogram/calendar-projection";

/**
 * Core portion-recommendation-plus-saved-value computation for one phase
 * -- factored out of domains/trainer/service.ts#getMealPortionRecommendations
 * (2026-08-07) so domains/trainermealprogram/materialize.ts can reuse the
 * exact same "saved servings, else live-computed recommendation" logic
 * when writing real meal_plan_items, instead of duplicating it. No auth
 * check here -- callers own that: getMealPortionRecommendations still
 * guards with requireTrainer/requireActiveClient before calling in, and
 * materialize.ts trusts its own caller the same way
 * domains/trainerprogram/materialize.ts already does (a plain clientId,
 * called from contexts with no user session -- cron, or another server
 * action that already checked).
 */
export async function getMealPortionRows(
  phaseId: string,
  assignmentId: string | null,
  calorieTarget: number | null,
  supabase: SupabaseClient<Database>
): Promise<MealPortionRow[]> {
  const { data: mealRows } = await supabase.from("trainer_meal_program_meals").select("*").eq("phase_id", phaseId);
  if (!mealRows || mealRows.length === 0) return [];

  const recipeIds = Array.from(new Set(mealRows.map((m) => m.recipe_id)));
  const { data: recipeRows } = await supabase
    .from("recipes")
    .select("id, name, calories, protein_g")
    .in("id", recipeIds);
  const recipeById = new Map((recipeRows ?? []).map((r) => [r.id, r]));

  const mealsPerDay = new Map<number, number>();
  for (const m of mealRows) {
    mealsPerDay.set(m.day_of_week, (mealsPerDay.get(m.day_of_week) ?? 0) + 1);
  }

  let savedByMealId = new Map<string, number>();
  if (assignmentId) {
    const { data: portionRows } = await supabase
      .from("trainer_meal_program_portions")
      .select("program_meal_id, servings")
      .eq("assignment_id", assignmentId)
      .in(
        "program_meal_id",
        mealRows.map((m) => m.id)
      );
    savedByMealId = new Map((portionRows ?? []).map((p) => [p.program_meal_id, p.servings]));
  }

  const effectiveTarget = calorieTarget ?? 2000;
  return mealRows.map((m) => {
    const recipe = recipeById.get(m.recipe_id);
    return {
      programMealId: m.id,
      dayOfWeek: m.day_of_week,
      mealType: m.meal_type as MealPortionRow["mealType"],
      recipeId: m.recipe_id,
      recipeName: recipe?.name ?? "—",
      baseCalories: recipe?.calories ?? 0,
      baseProteinG: recipe?.protein_g ?? 0,
      recommendedServings: recommendServings(
        effectiveTarget,
        mealsPerDay.get(m.day_of_week) ?? 1,
        recipe?.calories ?? 0
      ),
      savedServings: savedByMealId.get(m.id) ?? null,
    };
  });
}

/**
 * Fills in real servings for every template-sourced meal in a projected
 * date range -- projectMealProgramRange itself always leaves
 * ProjectedMeal.servings null for a template meal (a pure projection has
 * no calorie-target input to compute a recommendation from, per that
 * module's own comment), so both materialize.ts (writing real
 * meal_plan_items) and the calendar UI (showing/pre-filling a day's real
 * servings before a trainer edits it) need this same resolution step.
 * Factored out here specifically so the two callers can't drift --
 * before this existed, the calendar's day editor pre-filled every
 * template meal's servings as a bare "1" (ProjectedMeal.servings ??
 * 1-in-the-UI), which would have silently shrunk a real ~4x recommended
 * portion down to 1x the moment a trainer edited *any* field on that day
 * and hit Save, since the override would then carry the wrong quantity
 * forward. Override-sourced meals are returned unchanged -- they already
 * carry an explicit trainer-set quantity.
 */
export async function resolveMealDayServings(
  days: ProjectedMealDay[],
  assignmentId: string,
  calorieTarget: number | null,
  supabase: SupabaseClient<Database>
): Promise<ProjectedMealDay[]> {
  const templatePhaseIds = Array.from(
    new Set(days.filter((d) => d.source === "template" && d.phaseId).map((d) => d.phaseId as string))
  );
  if (templatePhaseIds.length === 0) return days;

  const portionRowsByPhase = new Map<string, MealPortionRow[]>();
  for (const phaseId of templatePhaseIds) {
    portionRowsByPhase.set(phaseId, await getMealPortionRows(phaseId, assignmentId, calorieTarget, supabase));
  }

  return days.map((day) => {
    if (day.source !== "template" || !day.phaseId) return day;
    const portionRows = portionRowsByPhase.get(day.phaseId) ?? [];
    return {
      ...day,
      meals: day.meals.map((meal) => {
        if (meal.servings !== null || !meal.sourceMealId) return meal;
        const portionRow = portionRows.find((r) => r.programMealId === meal.sourceMealId);
        return { ...meal, servings: portionRow?.savedServings ?? portionRow?.recommendedServings ?? 1 };
      }),
    };
  });
}
