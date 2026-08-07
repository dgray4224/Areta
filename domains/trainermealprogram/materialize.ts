"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import { getHydratedPhasesForMealProgram } from "@/domains/trainermealprogram/service";
import { getMealOverridesForRange } from "@/domains/trainermealprogram/overrides";
import { resolveMealDayServings } from "@/domains/trainermealprogram/portions";
import {
  projectMealProgramRange,
  addDays,
  sundayOfWeekContaining,
} from "@/domains/trainermealprogram/calendar-projection";
import { getWeekDates } from "@/platform/ui/week-dates";
import type { NutritionOverride } from "@/domains/trainermealprogram/types";
import type { HydratedTrainerMealProgramPhase } from "@/domains/trainermealprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type MealAssignmentRow = Database["public"]["Tables"]["trainer_meal_program_assignments"]["Row"];

/**
 * The actual per-week materialization, shared by materializeCurrentMealWeek
 * (always "this week", anchored to real today) and materializeMealWeekContaining
 * (an explicit date, possibly a future week a trainer just edited on the
 * calendar) -- exact structural mirror of domains/trainerprogram/
 * materialize.ts#materializeWeek, adapted for meals instead of sessions/
 * exercises. `anchorDate` picks which Sun-Sat week's content to write and
 * becomes meal_plans.week_start for that row, same convention the workout
 * side uses (getWeekDates always resolves the real Sun-Sat week for
 * display regardless of what day within it the anchor falls on -- see
 * platform/ui/week-dates.ts's own comment).
 *
 * Always writes straight to 'active' -- the trainer-managed-client
 * exception to CLAUDE.md rule 10 (a trainer's own assignment/edit is
 * itself the review step), same as every other trainer-program
 * materialization path in this app.
 *
 * Servings: an override-sourced meal (calendar-projection.ts's own
 * ProjectedMeal.servings) already carries an explicit trainer-set
 * quantity. A template-sourced meal doesn't -- its servings resolve from
 * getMealPortionRows (saved portion, else the live-computed
 * recommendation), looked up once per distinct phase appearing in the
 * projected week (a week can straddle a phase boundary, so more than one
 * phase's portions may need resolving) rather than once for the whole
 * week, which would silently use the wrong phase's portions for
 * whichever days fall in a different phase.
 */
async function materializeMealWeek(
  clientId: string,
  assignmentRow: MealAssignmentRow,
  phases: HydratedTrainerMealProgramPhase[],
  anchorDate: string,
  supabase: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const weekStart = sundayOfWeekContaining(anchorDate);
  const weekEnd = addDays(weekStart, 6);

  const overridesByDate = await getMealOverridesForRange(assignmentRow.id, weekStart, weekEnd, supabase);
  const projectedDays = projectMealProgramRange({
    startsOn: assignmentRow.starts_on,
    endDate: assignmentRow.end_date,
    phases,
    rangeStart: weekStart,
    rangeEnd: weekEnd,
    overridesByDate,
  });

  const warnings: string[] = [];
  const anchorProjection = projectedDays.find((d) => d.date === anchorDate) ?? projectedDays[0];
  // No phase_focus-equivalent column on meal_plans (unlike workout_plans),
  // so only phaseId is carried through -- trainer_meal_program_phase_id
  // already gives the client's nutrition page everything it displays.
  const phaseId = anchorProjection?.phaseId ?? null;
  if (projectedDays.every((d) => d.meals.length === 0)) {
    warnings.push(`No meals are scheduled the week of ${weekStart} — check the calendar or phase content.`);
  }

  const nutritionOverride = (assignmentRow.nutrition_override as unknown as NutritionOverride | null) ?? null;
  const [approvedCalorieTarget, approvedProteinTarget] = await Promise.all([
    getApprovedParameterValue(clientId, "nutrition", "calorie_target"),
    getApprovedParameterValue(clientId, "nutrition", "protein_target_g"),
  ]);
  const calorieTarget = nutritionOverride?.calorieTarget ?? approvedCalorieTarget;
  const proteinTarget = nutritionOverride?.proteinTarget ?? approvedProteinTarget;

  const resolvedDays = await resolveMealDayServings(projectedDays, assignmentRow.id, calorieTarget, supabase);

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .upsert(
      {
        user_id: clientId,
        week_start: anchorDate,
        status: "active",
        calorie_target: calorieTarget,
        protein_target: proteinTarget,
        trainer_meal_program_id: assignmentRow.program_id,
        trainer_meal_program_phase_id: phaseId,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();
  if (planError || !plan) return { ok: false, error: `Failed to save meal plan: ${planError?.message}` };

  const { error: deleteError } = await supabase.from("meal_plan_items").delete().eq("meal_plan_id", plan.id);
  if (deleteError) return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };

  const items = resolvedDays.flatMap((day) =>
    day.meals.map((meal) => ({
      meal_plan_id: plan.id,
      user_id: clientId,
      day_of_week: day.dayOfWeek,
      meal_type: meal.mealType,
      recipe_id: meal.recipeId,
      servings: meal.servings ?? 1,
      trainer_meal_program_meal_id: meal.sourceMealId,
    }))
  );

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("meal_plan_items").insert(items);
    if (itemsError) return { ok: false, error: `Failed to save meal plan items: ${itemsError.message}` };
  }

  return { ok: true, data: { warnings } };
}

/**
 * Turns a client's active trainer_meal_program_assignment into a concrete
 * active week in meal_plans/meal_plan_items -- always anchored to real
 * today's week. For materializing a specific *future* week a trainer just
 * edited on the calendar, see materializeMealWeekContaining below, which
 * shares this function's core (materializeMealWeek) but takes an explicit
 * date instead of always "today."
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

  // Hard cutoff -- ends itself rather than generating past its stated end
  // date. The row is never deleted (status: 'ended'), exactly what the
  // trainer's "past programs" list reads to offer reassigning it later.
  if (assignmentRow.end_date && today > assignmentRow.end_date) {
    await supabase
      .from("trainer_meal_program_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", assignmentRow.id);
    return { ok: true, data: { warnings: [`This program ended on ${assignmentRow.end_date}.`] } };
  }

  const weekEnd = addDays(sundayOfWeekContaining(today), 6);
  if (assignmentRow.starts_on > weekEnd) {
    return {
      ok: true,
      data: { warnings: [`This program starts ${assignmentRow.starts_on} — nothing to generate for this week yet.`] },
    };
  }

  const phases = await getHydratedPhasesForMealProgram(assignmentRow.program_id, supabase);
  if (phases.length === 0) return { ok: false, error: "This program has no phases defined yet." };

  return materializeMealWeek(clientId, assignmentRow, phases, today, supabase);
}

/**
 * Auto-sync counterpart to a manual calendar edit (domains/trainer/
 * service.ts's date-override wrappers call this right after every
 * calendar save/clear succeeds): re-materializes just the Sun-Sat week
 * containing `date` -- current week or several weeks ahead, doesn't
 * matter -- so a trainer's calendar edit reaches the client immediately.
 * Deliberately quiet on the "nothing scheduled this week" warning
 * materializeMealWeek can return -- expected noise for a single no-
 * program-day edit, not worth surfacing on every save.
 */
export async function materializeMealWeekContaining(
  clientId: string,
  date: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("trainer_meal_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError) return { ok: false, error: assignmentError.message };
  if (!assignmentRow) return { ok: true, data: undefined };

  const phases = await getHydratedPhasesForMealProgram(assignmentRow.program_id, supabase);
  if (phases.length === 0) return { ok: true, data: undefined };

  const result = await materializeMealWeek(clientId, assignmentRow, phases, date, supabase);
  if (!result.ok) return result;
  return { ok: true, data: undefined };
}

/**
 * The builder-edit counterpart to the write paths that already re-sync a
 * single client (assign/unassign, portions, engagement targets, calendar
 * overrides, all in domains/trainer/service.ts): a trainer changing a
 * program's own meals or phases has no single client to hang a sync off
 * of, so domains/trainermealprogram/service.ts's mutation functions call
 * this instead, after every successful save, with whatever program the
 * edit belongs to. Exact mirror of domains/trainerprogram/materialize.ts's
 * own resyncAssignedClients -- see that function's doc comment for the
 * "why not fail the save, why current week only" reasoning, unchanged
 * here.
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
 * reasoning, and why the boundary is the Sunday of the current calendar
 * week, not literal today -- a row's week_start can anchor a day or two
 * before today while still describing today/tomorrow's content). Now
 * genuinely exploitable on the nutrition side too, now that the calendar
 * lets materializeMealWeekContaining anchor at any date, not just literal
 * "today" -- kept in parity from the start rather than fixed after the
 * fact this time. Only touches this-week-or-later -- a genuinely bygone
 * earlier week is real history of what the client actually ate, not
 * something a program switch should erase. */
export async function archiveStaleTrainerMealPlans(
  clientId: string,
  trainerMealProgramId: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const thisWeekStart = getWeekDates(todayIso())[0];
  await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("user_id", clientId)
    .eq("trainer_meal_program_id", trainerMealProgramId)
    .gte("week_start", thisWeekStart)
    .neq("status", "archived");
}
