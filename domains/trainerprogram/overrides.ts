"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import type { DateOverrideInput, ProjectedExercise } from "@/domains/trainerprogram/calendar-projection";

/** Plain, clientId-taking functions that trust RLS rather than deriving
 * identity themselves -- same layering as domains/workoutplan/service.ts
 * vs domains/trainer/service.ts elsewhere in this file's neighborhood.
 * The requireTrainer()+requireActiveClient() gate lives in
 * domains/trainer/service.ts's wrappers, not here, so these are also
 * safely callable from the weekly cron's service-role client
 * (getOverridesForRange, via materialize.ts) without a session. */

function toOverrideExercise(
  row: Database["public"]["Tables"]["trainer_program_date_override_exercises"]["Row"]
): ProjectedExercise {
  return {
    exerciseId: row.exercise_id,
    sets: row.sets,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    intensityType: row.intensity_type as ProjectedExercise["intensityType"],
    intensityValue: row.intensity_value,
    durationMinutes: row.duration_minutes,
    cardioIntensity: row.cardio_intensity,
    coachingNotes: row.coaching_notes,
    sourceSessionExerciseId: null,
  };
}

export async function getOverridesForRange(
  assignmentId: string,
  rangeStart: string,
  rangeEnd: string,
  client?: SupabaseClient<Database>
): Promise<Map<string, DateOverrideInput>> {
  const supabase = client ?? (await createClient());

  const { data: overrideRows, error } = await supabase
    .from("trainer_program_date_overrides")
    .select("*")
    .eq("assignment_id", assignmentId)
    .gte("override_date", rangeStart)
    .lte("override_date", rangeEnd);
  if (error) throw new Error(`Failed to load date overrides: ${error.message}`);
  if (!overrideRows || overrideRows.length === 0) return new Map();

  const overrideIds = overrideRows.map((r) => r.id);
  const { data: exerciseRows, error: exError } = await supabase
    .from("trainer_program_date_override_exercises")
    .select("*")
    .in("override_id", overrideIds)
    .order("exercise_order", { ascending: true });
  if (exError) throw new Error(`Failed to load date override exercises: ${exError.message}`);

  const exercisesByOverride = new Map<string, ProjectedExercise[]>();
  for (const row of exerciseRows ?? []) {
    const list = exercisesByOverride.get(row.override_id) ?? [];
    list.push(toOverrideExercise(row));
    exercisesByOverride.set(row.override_id, list);
  }

  const result = new Map<string, DateOverrideInput>();
  for (const row of overrideRows) {
    result.set(row.override_date, {
      isRestDay: row.is_rest_day,
      exercises: row.is_rest_day ? [] : (exercisesByOverride.get(row.id) ?? []),
    });
  }
  return result;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getActiveAssignmentFor(
  clientId: string,
  supabase: SupabaseClient<Database>
): Promise<{ id: string; trainerId: string; startsOn: string } | null> {
  const { data } = await supabase
    .from("trainer_program_assignments")
    .select("id, trainer_id, starts_on")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, trainerId: data.trainer_id, startsOn: data.starts_on };
}

/** A date before today (already lived) or before the program's own
 * starts_on can't be overridden -- the calendar UI also disables this
 * client-side, but the real gate is here since Server Actions are
 * reachable independent of which page renders them. */
function validateEditableDate(date: string, startsOn: string): string | null {
  const today = todayIso();
  if (date < today) return "Can't edit a date that's already passed.";
  if (date < startsOn) return "This program hasn't started yet on that date.";
  return null;
}

export type OverrideExerciseInput = Omit<ProjectedExercise, "sourceSessionExerciseId">;

export async function setDateOverride(
  clientId: string,
  date: string,
  input: { isRestDay: boolean; exercises: OverrideExerciseInput[] },
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  const assignment = await getActiveAssignmentFor(clientId, supabase);
  if (!assignment) return { ok: false, error: "No active program assigned." };
  const dateError = validateEditableDate(date, assignment.startsOn);
  if (dateError) return { ok: false, error: dateError };

  const { data: overrideRow, error: upsertError } = await supabase
    .from("trainer_program_date_overrides")
    .upsert(
      {
        assignment_id: assignment.id,
        trainer_id: assignment.trainerId,
        client_id: clientId,
        override_date: date,
        is_rest_day: input.isRestDay,
      },
      { onConflict: "assignment_id,override_date" }
    )
    .select("id")
    .single();
  if (upsertError || !overrideRow) return { ok: false, error: upsertError?.message ?? "Failed to save override." };

  const { error: deleteError } = await supabase
    .from("trainer_program_date_override_exercises")
    .delete()
    .eq("override_id", overrideRow.id);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (!input.isRestDay && input.exercises.length > 0) {
    const { error: insertError } = await supabase.from("trainer_program_date_override_exercises").insert(
      input.exercises.map((ex, index) => ({
        override_id: overrideRow.id,
        exercise_order: index,
        exercise_id: ex.exerciseId,
        sets: ex.sets,
        reps_min: ex.repsMin,
        reps_max: ex.repsMax,
        intensity_type: ex.intensityType,
        intensity_value: ex.intensityValue,
        duration_minutes: ex.durationMinutes,
        cardio_intensity: ex.cardioIntensity,
        coaching_notes: ex.coachingNotes,
      }))
    );
    if (insertError) return { ok: false, error: insertError.message };
  }

  return { ok: true, data: undefined };
}

/** "Reset to template" -- deletes the override row entirely (cascades to
 * its exercises), reverting that date back to whatever the recurring
 * day-of-week session says. */
export async function clearDateOverride(
  clientId: string,
  date: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  const assignment = await getActiveAssignmentFor(clientId, supabase);
  if (!assignment) return { ok: false, error: "No active program assigned." };
  const dateError = validateEditableDate(date, assignment.startsOn);
  if (dateError) return { ok: false, error: dateError };

  const { error } = await supabase
    .from("trainer_program_date_overrides")
    .delete()
    .eq("assignment_id", assignment.id)
    .eq("override_date", date);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
