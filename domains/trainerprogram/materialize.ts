"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getHydratedPhasesForProgram } from "@/domains/trainerprogram/service";
import { getOverridesForRange } from "@/domains/trainerprogram/overrides";
import { projectProgramRange, addDays, sundayOfWeekContaining } from "@/domains/trainerprogram/calendar-projection";
import type { OnProgramComplete } from "@/domains/trainerprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Turns a client's active trainer_program_assignment into a concrete
 * draft week in workout_plans/workout_plan_items — the trainer-program
 * analog of domains/workoutplan/service.ts's generateAndSaveWorkoutPlan,
 * called from the same two places that one is: a manual trainer action
 * (domains/trainer/service.ts) and the weekly cron
 * (app/api/cron/regenerate-workout-plans/route.ts), neither of which has
 * a user session — so, same convention, this takes a plain clientId and
 * trusts RLS/the caller's own client rather than deriving identity
 * itself. Still only ever produces a DRAFT (CLAUDE.md rule 10) —
 * approval happens the same way as any other plan.
 *
 * Rewritten (2026-08-06, calendar feature) to compute the target week
 * via calendar-projection.ts's pure projectProgramRange instead of a
 * stored "pointer" that got manually advanced — the same function the
 * calendar UI uses to show a trainer what any date looks like, so
 * regenerating is now naturally idempotent (same inputs -> same output,
 * no special-casing needed to detect "is this a re-run") and a date
 * override a trainer sets always lands correctly whenever that week
 * next gets materialized, without this function needing to know
 * anything about overrides beyond fetching them.
 *
 * workout_plans keeps the rest of the app's existing (slightly
 * misleading) "week_start" convention: it's literally today's date at
 * generation time, not an aligned Sunday — see getWorkoutPlanForWeek's
 * callers, which all key off "whatever date generation last ran" as an
 * opaque version identifier. The *items* still span the full Sun-Sat
 * calendar week containing today (sundayOfWeekContaining), matching how
 * the shared library's own generator always produces day_of_week 0-6
 * regardless of which weekday generation happens to run on.
 */
export async function generateAndSaveFromTrainerProgram(
  clientId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const today = todayIso();
  const weekStart = sundayOfWeekContaining(today);
  const weekEnd = addDays(weekStart, 6);

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError) return { ok: false, error: assignmentError.message };
  if (!assignmentRow) return { ok: false, error: "No active trainer program assigned." };

  // Hard cutoff (migration 0078): once the stated end date has passed,
  // the assignment ends itself rather than generating further weeks --
  // "every program needs a start and end date" means the end date is a
  // real boundary, not just a display label. The row is never deleted
  // (status: 'ended', same as a manual unassign) -- it's exactly what
  // the trainer's "past programs" list reads to offer reassigning it,
  // possibly with modifications, later.
  if (assignmentRow.end_date && today > assignmentRow.end_date) {
    await supabase
      .from("trainer_program_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", assignmentRow.id);
    return {
      ok: true,
      data: { warnings: [`This program ended on ${assignmentRow.end_date}.`] },
    };
  }

  if (assignmentRow.starts_on > weekEnd) {
    return {
      ok: true,
      data: { warnings: [`This program starts ${assignmentRow.starts_on} — nothing to generate for this week yet.`] },
    };
  }

  const phases = await getHydratedPhasesForProgram(assignmentRow.program_id, supabase);
  if (phases.length === 0) return { ok: false, error: "This program has no phases defined yet." };

  const overridesByDate = await getOverridesForRange(assignmentRow.id, weekStart, weekEnd, supabase);

  const projectedDays = projectProgramRange({
    startsOn: assignmentRow.starts_on,
    endDate: assignmentRow.end_date,
    phases,
    onComplete: assignmentRow.on_complete as OnProgramComplete,
    rangeStart: weekStart,
    rangeEnd: weekEnd,
    overridesByDate,
  });

  const warnings: string[] = [];
  const todaysProjection = projectedDays.find((d) => d.date === today) ?? projectedDays[0];
  const phaseName = todaysProjection?.phaseName ?? null;
  const phaseId = todaysProjection?.phaseId ?? null;
  if (projectedDays.every((d) => d.exercises.length === 0)) {
    warnings.push("No sessions are scheduled this week — check the calendar or phase content.");
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: clientId,
        week_start: today,
        status: "draft",
        phase_focus: phaseName,
        trainer_program_id: assignmentRow.program_id,
        trainer_program_phase_id: phaseId,
        program_id: null,
        program_phase_id: null,
        phase_week_number: null,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();
  if (planError || !plan) return { ok: false, error: `Failed to save workout plan: ${planError?.message}` };

  const { error: deleteError } = await supabase.from("workout_plan_items").delete().eq("workout_plan_id", plan.id);
  if (deleteError) return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };

  const items = projectedDays.flatMap((day) =>
    day.exercises.map((ex, index) => ({
      workout_plan_id: plan.id,
      user_id: clientId,
      day_of_week: day.dayOfWeek,
      session_order: index,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.repsMax ?? ex.repsMin,
      duration_minutes: ex.durationMinutes,
      trainer_program_session_exercise_id: ex.sourceSessionExerciseId,
      reps_min: ex.repsMin,
      reps_max: ex.repsMax,
      intensity_type: ex.intensityType,
      intensity_value: ex.intensityValue,
      cardio_intensity: ex.cardioIntensity,
      coaching_notes: ex.coachingNotes,
      substituted: false,
    }))
  );

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("workout_plan_items").insert(items);
    if (itemsError) return { ok: false, error: `Failed to save workout plan items: ${itemsError.message}` };
  }

  return { ok: true, data: { warnings } };
}
