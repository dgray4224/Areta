"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import type { MealDateOverrideInput, ProjectedMeal } from "@/domains/trainermealprogram/calendar-projection";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";

/** Plain, clientId-taking functions that trust RLS rather than deriving
 * identity themselves -- same layering as domains/trainerprogram/
 * overrides.ts vs domains/trainer/service.ts, and for the same reason:
 * getMealOverridesForRange needs to be safely callable from
 * materialize.ts's service-role-client paths (a weekly cron, once one
 * exists for calendar-aware re-materialization) without a session. */

function toOverrideMeal(
  row: Database["public"]["Tables"]["trainer_meal_program_date_override_meals"]["Row"]
): ProjectedMeal {
  return {
    mealType: row.meal_type as ProjectedMeal["mealType"],
    recipeId: row.recipe_id,
    servings: row.servings,
    sourceMealId: null,
  };
}

export async function getMealOverridesForRange(
  assignmentId: string,
  rangeStart: string,
  rangeEnd: string,
  client?: SupabaseClient<Database>
): Promise<Map<string, MealDateOverrideInput>> {
  const supabase = client ?? (await createClient());

  const { data: overrideRows, error } = await supabase
    .from("trainer_meal_program_date_overrides")
    .select("*")
    .eq("assignment_id", assignmentId)
    .gte("override_date", rangeStart)
    .lte("override_date", rangeEnd);
  if (error) throw new Error(`Failed to load date overrides: ${error.message}`);
  if (!overrideRows || overrideRows.length === 0) return new Map();

  const overrideIds = overrideRows.map((r) => r.id);
  const { data: mealRows, error: mealsError } = await supabase
    .from("trainer_meal_program_date_override_meals")
    .select("*")
    .in("override_id", overrideIds)
    .order("meal_order", { ascending: true });
  if (mealsError) throw new Error(`Failed to load date override meals: ${mealsError.message}`);

  const mealsByOverride = new Map<string, ProjectedMeal[]>();
  for (const row of mealRows ?? []) {
    const list = mealsByOverride.get(row.override_id) ?? [];
    list.push(toOverrideMeal(row));
    mealsByOverride.set(row.override_id, list);
  }

  const result = new Map<string, MealDateOverrideInput>();
  for (const row of overrideRows) {
    result.set(row.override_date, {
      isNoProgramDay: row.is_no_program_day,
      meals: row.is_no_program_day ? [] : (mealsByOverride.get(row.id) ?? []),
    });
  }
  return result;
}

async function getActiveMealAssignmentFor(
  clientId: string,
  supabase: SupabaseClient<Database>
): Promise<{ id: string; trainerId: string; startsOn: string; endDate: string | null } | null> {
  const { data } = await supabase
    .from("trainer_meal_program_assignments")
    .select("id, trainer_id, starts_on, end_date")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, trainerId: data.trainer_id, startsOn: data.starts_on, endDate: data.end_date };
}

/** Same "can't rewrite history" gate as domains/trainerprogram/
 * overrides.ts#validateEditableDate, in the client's own profile time
 * zone rather than the server's UTC clock, for the same DST-safety
 * reasoning that function's own comment explains. */
async function validateEditableDate(
  date: string,
  startsOn: string,
  endDate: string | null,
  clientId: string,
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const timezone = await resolveTimezone(supabase, clientId);
  const today = localDateString(new Date(), timezone);
  if (date < today) return "Can't edit a date that's already passed.";
  if (date < startsOn) return "This program hasn't started yet on that date.";
  if (endDate && date > endDate) return "This program ends before that date.";
  return null;
}

export type OverrideMealInput = Omit<ProjectedMeal, "sourceMealId" | "servings"> & { servings: number };

export async function setMealDateOverride(
  clientId: string,
  date: string,
  input: { isNoProgramDay: boolean; meals: OverrideMealInput[] },
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  const assignment = await getActiveMealAssignmentFor(clientId, supabase);
  if (!assignment) return { ok: false, error: "No active nutrition program assigned." };
  const dateError = await validateEditableDate(date, assignment.startsOn, assignment.endDate, clientId, supabase);
  if (dateError) return { ok: false, error: dateError };

  const { data: overrideRow, error: upsertError } = await supabase
    .from("trainer_meal_program_date_overrides")
    .upsert(
      {
        assignment_id: assignment.id,
        trainer_id: assignment.trainerId,
        client_id: clientId,
        override_date: date,
        is_no_program_day: input.isNoProgramDay,
      },
      { onConflict: "assignment_id,override_date" }
    )
    .select("id")
    .single();
  if (upsertError || !overrideRow) return { ok: false, error: upsertError?.message ?? "Failed to save override." };

  const { error: deleteError } = await supabase
    .from("trainer_meal_program_date_override_meals")
    .delete()
    .eq("override_id", overrideRow.id);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (!input.isNoProgramDay && input.meals.length > 0) {
    const { error: insertError } = await supabase.from("trainer_meal_program_date_override_meals").insert(
      input.meals.map((m, index) => ({
        override_id: overrideRow.id,
        meal_order: index,
        meal_type: m.mealType,
        recipe_id: m.recipeId,
        servings: m.servings,
      }))
    );
    if (insertError) return { ok: false, error: insertError.message };
  }

  return { ok: true, data: undefined };
}

/** "Reset to template" -- deletes the override row entirely (cascades to
 * its meals), reverting that date back to whatever the recurring
 * day-of-week pattern says. */
export async function clearMealDateOverride(
  clientId: string,
  date: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  const assignment = await getActiveMealAssignmentFor(clientId, supabase);
  if (!assignment) return { ok: false, error: "No active nutrition program assigned." };
  const dateError = await validateEditableDate(date, assignment.startsOn, assignment.endDate, clientId, supabase);
  if (dateError) return { ok: false, error: dateError };

  const { error } = await supabase
    .from("trainer_meal_program_date_overrides")
    .delete()
    .eq("assignment_id", assignment.id)
    .eq("override_date", date);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
