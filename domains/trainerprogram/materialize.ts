"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getPhaseById, getNextPhase, getFirstPhase, getPhaseHydrated } from "@/domains/trainerprogram/service";
import { resolveTrainerProgramProgression } from "@/domains/trainerprogram/progression";
import type { OnProgramComplete } from "@/domains/trainerprogram/types";

function currentWeekStart(): string {
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
 * itself. Still only ever produces a DRAFT (CLAUDE.md rule 10) — approval
 * happens the same way as any other plan, via the client's or trainer's
 * "Approve plan" action.
 *
 * Unlike the shared library's generator (which decides continue-vs-
 * advance by looking backward at the last *completed* week), this stores
 * a forward pointer directly on the assignment row: (current_phase_id,
 * phase_week_number) always means "the phase/week to use the next time a
 * *new* week is generated". Regenerating the *same* week (trainer clicks
 * "Regenerate" twice, or the cron somehow fires twice for one week)
 * re-materializes from whatever phase that week's existing plan already
 * points to, without moving the pointer again — otherwise every
 * redundant regenerate call would silently skip the client ahead an
 * extra week.
 */
export async function generateAndSaveFromTrainerProgram(
  clientId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const weekStart = currentWeekStart();

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("trainer_program_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError) return { ok: false, error: assignmentError.message };
  if (!assignmentRow || !assignmentRow.current_phase_id) {
    return { ok: false, error: "No active trainer program assigned." };
  }

  const { data: existingPlan } = await supabase
    .from("workout_plans")
    .select("trainer_program_phase_id")
    .eq("user_id", clientId)
    .eq("week_start", weekStart)
    .eq("trainer_program_id", assignmentRow.program_id)
    .maybeSingle();

  const warnings: string[] = [];
  let targetPhaseId: string;
  let advanceTo: { phaseId: string; weekNumber: number } | null = null;

  if (existingPlan?.trainer_program_phase_id) {
    // Same-week regenerate: re-materialize the phase this week already
    // points to (picks up any edits the trainer made since), no
    // progression change.
    targetPhaseId = existingPlan.trainer_program_phase_id;
  } else {
    // A genuinely new week: use the assignment's pointer as-is, then
    // compute where the pointer should move to for the week after this
    // one.
    targetPhaseId = assignmentRow.current_phase_id;
    const [currentPhase, firstPhase] = await Promise.all([
      getPhaseById(assignmentRow.current_phase_id, supabase),
      getFirstPhase(assignmentRow.program_id, supabase),
    ]);
    if (!currentPhase || !firstPhase) {
      return { ok: false, error: "This program has no phases defined yet." };
    }
    const nextPhase = currentPhase.isFinal ? null : await getNextPhase(currentPhase, supabase);
    advanceTo = resolveTrainerProgramProgression({
      currentPhase,
      currentWeekNumber: assignmentRow.phase_week_number,
      nextPhase,
      firstPhase,
      onComplete: assignmentRow.on_complete as OnProgramComplete,
    });
  }

  const hydratedPhase = await getPhaseHydrated(targetPhaseId, supabase);
  if (!hydratedPhase) return { ok: false, error: "Failed to load phase content." };
  if (hydratedPhase.sessions.length === 0) {
    warnings.push(`"${hydratedPhase.name}" has no sessions defined yet — this week will be entirely rest days.`);
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: clientId,
        week_start: weekStart,
        status: "draft",
        phase_focus: hydratedPhase.focus,
        trainer_program_id: assignmentRow.program_id,
        trainer_program_phase_id: hydratedPhase.id,
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

  const items = hydratedPhase.sessions.flatMap((session) =>
    session.exercises.map((ex) => ({
      workout_plan_id: plan.id,
      user_id: clientId,
      day_of_week: session.dayOfWeek,
      session_order: ex.exerciseOrder,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.repsMax ?? ex.repsMin,
      duration_minutes: ex.durationMinutes,
      trainer_program_session_exercise_id: ex.id,
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

  if (advanceTo) {
    const { error: updateError } = await supabase
      .from("trainer_program_assignments")
      .update({ current_phase_id: advanceTo.phaseId, phase_week_number: advanceTo.weekNumber })
      .eq("id", assignmentRow.id);
    if (updateError) {
      warnings.push(`Plan generated, but progression tracking failed to update: ${updateError.message}`);
    }
  }

  return { ok: true, data: { warnings } };
}
