"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import { resolveMealProgramPhase } from "@/domains/trainermealprogram/phase-resolution";
import { getMealPortionRows } from "@/domains/trainermealprogram/portions";
import type { NutritionOverride } from "@/domains/trainermealprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Turns a client's active trainer_meal_program_assignment into real
 * meal_plans/meal_plan_items content -- the nutrition-side analog of
 * domains/trainerprogram/materialize.ts#generateAndSaveFromTrainerProgram
 * (see that file's own comments for conventions reused here without
 * re-explaining them: plain clientId, no user session assumed, always
 * writes straight to 'active' since a trainer's own assignment/edit is
 * itself the review step under CLAUDE.md rule 10's trainer-managed-client
 * exception).
 *
 * One key structural difference from the workout side: nutrition has no
 * calendar/override system yet, so there's no per-date projection needed.
 * trainer_meal_program_meals.day_of_week is already a literal Sun(0)-
 * Sat(6) slot -- the same convention meal_plan_items and
 * platform/ui/week-dates.ts#getWeekDates already use for every other meal
 * plan in this app -- so a phase's meals copy across directly with no
 * date arithmetic. meal_plans.week_start also follows the existing
 * self-service convention (domains/mealplan/service.ts's own
 * currentWeekStart(): literal "today", not forced to a Sunday -- display
 * always resolves the real Sun-Sat week via getWeekDates regardless of
 * what day generation happened to run on).
 *
 * Servings come from getMealPortionRows: whatever the trainer already
 * saved for this client (trainer_meal_program_portions), else the live-
 * computed recommendation -- same "never silently baked into the
 * program" rule the portions screen has always followed, just now
 * actually reaching the client's plan instead of only informing that
 * screen. calorieTarget prefers the assignment's own engagement override
 * (migration 0084) over the client's long-range approved target, same
 * priority getMealPortionRecommendations already uses.
 */
export async function materializeCurrentMealWeek(
  clientId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const today = todayIso();

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("trainer_meal_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError) return { ok: false, error: assignmentError.message };
  if (!assignmentRow) return { ok: true, data: { warnings: ["No active nutrition program assigned."] } };

  // Hard cutoff, mirrors generateAndSaveFromTrainerProgram's own -- ends
  // itself rather than generating past its stated end date. The row is
  // never deleted (status: 'ended'), exactly what the trainer's "past
  // programs" list reads to offer reassigning it later.
  if (assignmentRow.end_date && today > assignmentRow.end_date) {
    await supabase
      .from("trainer_meal_program_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", assignmentRow.id);
    return { ok: true, data: { warnings: [`This program ended on ${assignmentRow.end_date}.`] } };
  }

  if (assignmentRow.starts_on > today) {
    return {
      ok: true,
      data: { warnings: [`This program starts ${assignmentRow.starts_on} — nothing to generate yet.`] },
    };
  }

  const { data: phaseRows } = await supabase
    .from("trainer_meal_program_phases")
    .select("id, name, length_weeks")
    .eq("program_id", assignmentRow.program_id)
    .order("phase_order", { ascending: true });
  if (!phaseRows || phaseRows.length === 0) return { ok: false, error: "This program has no phases defined yet." };

  const resolved = resolveMealProgramPhase(
    assignmentRow.starts_on,
    phaseRows.map((p) => ({ id: p.id, name: p.name, lengthWeeks: p.length_weeks })),
    today
  );
  if (!resolved) {
    return {
      ok: true,
      data: { warnings: ["This program's phases have run their full course — nothing scheduled this week."] },
    };
  }

  const nutritionOverride = (assignmentRow.nutrition_override as unknown as NutritionOverride | null) ?? null;
  const [approvedCalorieTarget, approvedProteinTarget] = await Promise.all([
    getApprovedParameterValue(clientId, "nutrition", "calorie_target"),
    getApprovedParameterValue(clientId, "nutrition", "protein_target_g"),
  ]);
  const calorieTarget = nutritionOverride?.calorieTarget ?? approvedCalorieTarget;
  const proteinTarget = nutritionOverride?.proteinTarget ?? approvedProteinTarget;

  const rows = await getMealPortionRows(resolved.phaseId, assignmentRow.id, calorieTarget, supabase);

  const warnings: string[] = [];
  if (rows.length === 0) {
    warnings.push(`No meals are scheduled for ${resolved.phaseName} — check the program builder.`);
  }

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .upsert(
      {
        user_id: clientId,
        week_start: today,
        status: "active",
        calorie_target: calorieTarget,
        protein_target: proteinTarget,
        trainer_meal_program_id: assignmentRow.program_id,
        trainer_meal_program_phase_id: resolved.phaseId,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();
  if (planError || !plan) return { ok: false, error: `Failed to save meal plan: ${planError?.message}` };

  const { error: deleteError } = await supabase.from("meal_plan_items").delete().eq("meal_plan_id", plan.id);
  if (deleteError) return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };

  const items = rows.map((row) => ({
    meal_plan_id: plan.id,
    user_id: clientId,
    day_of_week: row.dayOfWeek,
    meal_type: row.mealType,
    recipe_id: row.recipeId,
    servings: row.savedServings ?? row.recommendedServings,
    trainer_meal_program_meal_id: row.programMealId,
  }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("meal_plan_items").insert(items);
    if (itemsError) return { ok: false, error: `Failed to save meal plan items: ${itemsError.message}` };
  }

  return { ok: true, data: { warnings } };
}

/**
 * The builder-edit counterpart to the write paths that already re-sync a
 * single client (assign/unassign, portions, engagement targets, all in
 * domains/trainer/service.ts): a trainer changing a program's own meals
 * or phases has no single client to hang a sync off of, so
 * domains/trainermealprogram/service.ts's mutation functions call this
 * instead, after every successful save, with whatever program the edit
 * belongs to. Exact mirror of domains/trainerprogram/materialize.ts's own
 * resyncAssignedClients -- see that function's doc comment for the "why
 * not fail the save, why current week only" reasoning, unchanged here.
 */
export async function resyncAssignedMealClients(
  programId: string,
  client?: SupabaseClient<Database>
): Promise<{ synced: number; failed: number }> {
  const supabase = client ?? (await createClient());
  const { data: assignments } = await supabase
    .from("trainer_meal_program_assignments")
    .select("client_id")
    .eq("program_id", programId)
    .eq("status", "active");
  if (!assignments || assignments.length === 0) return { synced: 0, failed: 0 };

  const results = await Promise.allSettled(
    assignments.map((a) => materializeCurrentMealWeek(a.client_id, supabase))
  );
  const synced = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  return { synced, failed: results.length - synced };
}

/** Retires materialized meal_plans left behind by a program that just
 * got switched or unassigned -- exact nutrition-side mirror of
 * domains/trainer/service.ts's own archiveStaleTrainerProgramPlans (see
 * that function's doc comment for the full "why archive, not delete"
 * reasoning: getMealPlanForWeek et al. already treat 'archived' as
 * invisible without destroying history). Only touches today-or-later
 * weeks, same as the workout side -- past weeks are real history of what
 * the client actually ate, not something a program switch should erase. */
export async function archiveStaleTrainerMealPlans(
  clientId: string,
  trainerMealProgramId: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const today = todayIso();
  await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("user_id", clientId)
    .eq("trainer_meal_program_id", trainerMealProgramId)
    .gte("week_start", today)
    .neq("status", "archived");
}
