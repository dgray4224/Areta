"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getHydratedPhasesForProgram } from "@/domains/trainerprogram/service";
import { getOverridesForRange } from "@/domains/trainerprogram/overrides";
import { projectProgramRange, addDays, sundayOfWeekContaining, daysBetween } from "@/domains/trainerprogram/calendar-projection";
import type { OnProgramComplete, HydratedTrainerProgramPhase } from "@/domains/trainerprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type AssignmentRow = Database["public"]["Tables"]["trainer_program_assignments"]["Row"];

/**
 * The actual per-week materialization, shared by generateAndSaveFromTrainerProgram
 * (always "this week", anchored to real today) and
 * generateAndApproveWeeksThrough (an explicit anchor date, possibly
 * several weeks out). `anchorDate` picks which Sun-Sat week's content to
 * write and becomes workout_plans.week_start for that row -- see
 * getCurrentWorkoutPlan's doc comment (domains/workoutplan/service.ts)
 * for why that's safe for a future date: the lookup no longer requires
 * an exact match against "today", so a week materialized now for three
 * weeks out is still findable whenever that week actually arrives.
 * `forceActive` is true only for the explicit bulk-approve path --
 * everywhere else, status still depends on the assignment's own
 * auto_approve setting (or 'draft', requiring the normal approval step).
 */
async function materializeWeek(
  clientId: string,
  assignmentRow: AssignmentRow,
  phases: HydratedTrainerProgramPhase[],
  anchorDate: string,
  forceActive: boolean,
  supabase: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const weekStart = sundayOfWeekContaining(anchorDate);
  const weekEnd = addDays(weekStart, 6);

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
  const anchorProjection = projectedDays.find((d) => d.date === anchorDate) ?? projectedDays[0];
  const phaseName = anchorProjection?.phaseName ?? null;
  const phaseId = anchorProjection?.phaseId ?? null;
  if (projectedDays.every((d) => d.exercises.length === 0)) {
    warnings.push(`No sessions are scheduled the week of ${weekStart} — check the calendar or phase content.`);
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: clientId,
        week_start: anchorDate,
        status: forceActive || assignmentRow.auto_approve ? "active" : "draft",
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

/**
 * Turns a client's active trainer_program_assignment into a concrete
 * draft (or, if auto_approve is on, active) week in workout_plans/
 * workout_plan_items — the trainer-program analog of
 * domains/workoutplan/service.ts's generateAndSaveWorkoutPlan, called
 * from the same two places that one is: a manual trainer action
 * (domains/trainer/service.ts) and the weekly cron
 * (app/api/cron/regenerate-workout-plans/route.ts), neither of which has
 * a user session — so, same convention, this takes a plain clientId and
 * trusts RLS/the caller's own client rather than deriving identity
 * itself.
 *
 * Always anchored to real today's week -- for materializing a specific
 * *future* week ahead of schedule, see generateAndApproveWeeksThrough
 * below, which shares this function's core (materializeWeek) but loops
 * over an explicit range instead of always "this week".
 */
export async function generateAndSaveFromTrainerProgram(
  clientId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const today = todayIso();

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

  const weekEnd = addDays(sundayOfWeekContaining(today), 6);
  if (assignmentRow.starts_on > weekEnd) {
    return {
      ok: true,
      data: { warnings: [`This program starts ${assignmentRow.starts_on} — nothing to generate for this week yet.`] },
    };
  }

  const phases = await getHydratedPhasesForProgram(assignmentRow.program_id, supabase);
  if (phases.length === 0) return { ok: false, error: "This program has no phases defined yet." };

  return materializeWeek(clientId, assignmentRow, phases, today, false, supabase);
}

const MAX_BULK_WEEKS = 12;

/**
 * The manual "push future weeks live now" action (2026-08-06): a
 * trainer who's already customized several weeks ahead through the
 * calendar can pull them live today instead of waiting for the cron to
 * reach each one naturally, one at a time. Always materializes straight
 * to 'active' (forceActive=true in materializeWeek) regardless of the
 * assignment's own auto_approve setting -- clicking this button *is*
 * the explicit approval, for exactly the weeks it covers, no more.
 *
 * Capped at MAX_BULK_WEEKS and at the assignment's own end_date, so this
 * can't be used to generate an unbounded amount of content or push
 * content past where the program is supposed to stop. The real
 * auto-end check (has the assignment *actually* ended, as of right now)
 * still uses real today, never the requested throughDate -- pre-
 * generating weeks near or past end_date shouldn't retroactively end an
 * assignment that hasn't really ended yet.
 */
export async function generateAndApproveWeeksThrough(
  clientId: string,
  throughDate: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ weeksGenerated: number; warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const today = todayIso();
  if (throughDate < today) return { ok: false, error: "Pick a date today or in the future." };

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError) return { ok: false, error: assignmentError.message };
  if (!assignmentRow) return { ok: false, error: "No active trainer program assigned." };

  if (assignmentRow.end_date && today > assignmentRow.end_date) {
    await supabase
      .from("trainer_program_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", assignmentRow.id);
    return { ok: false, error: `This program already ended on ${assignmentRow.end_date}.` };
  }

  const effectiveThrough =
    assignmentRow.end_date && assignmentRow.end_date < throughDate ? assignmentRow.end_date : throughDate;
  const firstWeekStart = sundayOfWeekContaining(today);
  const lastWeekStart = sundayOfWeekContaining(effectiveThrough);
  const weekCount = Math.floor(daysBetween(firstWeekStart, lastWeekStart) / 7) + 1;

  if (weekCount > MAX_BULK_WEEKS) {
    return { ok: false, error: `That's ${weekCount} weeks — generate at most ${MAX_BULK_WEEKS} at a time.` };
  }

  const phases = await getHydratedPhasesForProgram(assignmentRow.program_id, supabase);
  if (phases.length === 0) return { ok: false, error: "This program has no phases defined yet." };

  const warnings: string[] = [];
  let weeksGenerated = 0;
  for (let i = 0; i < weekCount; i++) {
    const anchor = addDays(firstWeekStart, i * 7);
    if (assignmentRow.starts_on > addDays(anchor, 6)) continue; // whole week falls before the program starts
    const result = await materializeWeek(clientId, assignmentRow, phases, anchor, true, supabase);
    if (!result.ok) return result;
    warnings.push(...result.data.warnings);
    weeksGenerated++;
  }

  if (weeksGenerated === 0) {
    return { ok: false, error: "Nothing to generate — the program hasn't started yet in that range." };
  }

  return { ok: true, data: { weeksGenerated, warnings } };
}
