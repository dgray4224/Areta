"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import {
  generateAndSaveWorkoutPlan,
  getWorkoutPlanForWeek,
  workoutPlanExistsForWeek,
  type CustomizeExerciseInput,
} from "@/domains/workoutplan/service";

/**
 * Backs the mobile "Customize this week" workout flow -- distinct from
 * domains/workoutplan/service.ts's CRUD (whole-week destructive
 * generation, or single-item/single-"today" edits with no explicit
 * day-assignment concept). Mirrors domains/mealplan/customize.ts's
 * shape, but forks two ways since workouts aren't structurally uniform:
 * a program-based plan (workout_plans.program_phase_id set) has a real
 * "session" concept to assign whole, authored, exercises-in-order to a
 * day (assignWorkoutPlanSessionDays); a legacy/goal-first plan has no
 * session concept at all, only individual exercises
 * (assignWorkoutPlanExerciseDays). Callers must check which fork
 * applies (via the target week's programContext, already returned by
 * getWorkoutPlanForWeek) and call the matching function -- each rejects
 * outright if handed the wrong kind of plan.
 */
function validateDays(daysOfWeek: number[]): string | null {
  if (daysOfWeek.length === 0) return "Pick at least one day to assign this to.";
  if (daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Invalid day of week.";
  return null;
}

async function bootstrapIfMissing(
  userId: string,
  weekStart: string,
  supabase: SupabaseClient<Database>
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  if (await workoutPlanExistsForWeek(userId, weekStart, supabase)) return { ok: true, warnings: [] };
  // activateImmediately: true (2026-08-09) -- mirrors
  // domains/mealplan/customize.ts's identical bootstrap fix: without it,
  // customizing a future week with no existing plan would bootstrap a
  // 'draft' nothing ever approves, so the customization would silently
  // never show up as calendar dots. Harmless no-op for a trainer-assigned
  // user since generateAndSaveWorkoutPlan's own guard already refuses to
  // run for them regardless of this flag.
  const generateResult = await generateAndSaveWorkoutPlan(userId, { weekStart, activateImmediately: true }, supabase);
  if (!generateResult.ok) return generateResult;
  return { ok: true, warnings: generateResult.data.warnings };
}

/**
 * Assigns a program-authored session (its default, non-alternate
 * exercises) to one or more days of one week -- program-based plans
 * only. Per day, this is a full replace (mirrors
 * domains/workoutplan/service.ts#selectAlternativeSessionForToday's own
 * per-day materialization): a "session" IS the day's whole content, so
 * there's no partial-append ambiguity the way there is for individual
 * exercises. Unlike selectAlternativeSessionForToday, no pairwise
 * swap-partner logic -- the batch UI is explicit about every touched
 * day, nothing to infer or rebalance.
 */
export async function assignWorkoutPlanSessionDays(
  userId: string,
  weekStart: string,
  sessionId: string,
  daysOfWeek: number[],
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const daysError = validateDays(daysOfWeek);
  if (daysError) return { ok: false, error: daysError };

  const bootstrap = await bootstrapIfMissing(userId, weekStart, supabase);
  if (!bootstrap.ok) return bootstrap;

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .select("id, program_phase_id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  if (!plan) return { ok: false, error: "No workout plan exists for that week." };
  if (!plan.program_phase_id) {
    return { ok: false, error: "This week's plan wasn't generated from a training program and has no sessions to assign." };
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("program_sessions")
    .select("id, phase_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return { ok: false, error: sessionError.message };
  if (!sessionRow || sessionRow.phase_id !== plan.program_phase_id) {
    return { ok: false, error: "The requested session isn't part of this week's program phase." };
  }

  const { data: exerciseRows, error: exercisesError } = await supabase
    .from("program_session_exercises")
    .select("*")
    .eq("session_id", sessionId)
    .is("primary_exercise_id", null)
    .order("exercise_order", { ascending: true });
  if (exercisesError) return { ok: false, error: exercisesError.message };
  if (!exerciseRows || exerciseRows.length === 0) {
    return { ok: false, error: "That session has no exercises to assign." };
  }

  for (const day of daysOfWeek) {
    const { error: deleteError } = await supabase
      .from("workout_plan_items")
      .delete()
      .eq("workout_plan_id", plan.id)
      .eq("day_of_week", day);
    if (deleteError) return { ok: false, error: `Failed to clear that day's plan: ${deleteError.message}` };

    const { error: insertError } = await supabase.from("workout_plan_items").insert(
      exerciseRows.map((rx, index) => ({
        workout_plan_id: plan.id,
        user_id: userId,
        day_of_week: day,
        session_order: index,
        exercise_id: rx.exercise_id,
        sets: rx.sets,
        reps: rx.reps_max ?? rx.reps_min,
        duration_minutes: rx.duration_minutes,
        program_session_exercise_id: rx.id,
        reps_min: rx.reps_min,
        reps_max: rx.reps_max,
        intensity_type: rx.intensity_type,
        intensity_value: rx.intensity_value,
        cardio_intensity: rx.cardio_intensity,
        coaching_notes: rx.coaching_notes,
        substituted: false,
      }))
    );
    if (insertError) return { ok: false, error: `Failed to save the assigned session: ${insertError.message}` };
  }

  const historyRows = daysOfWeek.flatMap((day) =>
    exerciseRows.map((rx) => ({
      user_id: userId,
      exercise_id: rx.exercise_id,
      session_id: sessionId,
      week_start: weekStart,
      day_of_week: day,
    }))
  );
  const { error: historyError } = await supabase.from("exercise_pick_history").insert(historyRows);

  const warnings = [...bootstrap.warnings];
  if (historyError) warnings.push(`Preference tracking failed: ${historyError.message}`);
  return { ok: true, data: { warnings } };
}

/**
 * Assigns a single free-library exercise to one or more days of one week
 * -- legacy/goal-first plans only (no session concept to assign at that
 * granularity), matching how the existing "⇄" swap fallback already
 * treats these plans. Deliberately resolves the target plan via
 * getWorkoutPlanForWeek(weekStart) rather than delegating to the
 * existing addWorkoutPlanItemExercise, which only ever resolves
 * "whichever plan is most recently active" -- unsafe for editing a
 * non-current week, same class of fix as
 * domains/grocery/service.ts#generateAndSaveGroceryList's weekStart
 * param.
 *
 * "Assign to Monday" reads as replace, not append (this is what Monday
 * IS, not an addition to it) -- but only once: the first
 * assignment-flow pick for a given day clears that day's existing
 * (algorithm-generated) items first; a second pick for the *same* day
 * appends alongside the first, so a user building up several distinct
 * exercises for one day doesn't have each new pick wipe the last one.
 * "First touch" is detected via workout_plan_items.substituted rather
 * than any client-tracked session state, so it's correct even across
 * separate app sessions (add one exercise today, come back tomorrow and
 * add another to the same day -- still appends, doesn't re-wipe).
 */
export async function assignWorkoutPlanExerciseDays(
  userId: string,
  weekStart: string,
  input: CustomizeExerciseInput,
  daysOfWeek: number[],
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const daysError = validateDays(daysOfWeek);
  if (daysError) return { ok: false, error: daysError };

  const bootstrap = await bootstrapIfMissing(userId, weekStart, supabase);
  if (!bootstrap.ok) return bootstrap;

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .select("id, program_phase_id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  if (!plan) return { ok: false, error: "No workout plan exists for that week." };
  if (plan.program_phase_id) {
    return { ok: false, error: "This week's plan uses a training program -- assign a session instead of a single exercise." };
  }

  const { data: exerciseRow, error: exerciseError } = await supabase
    .from("exercises")
    .select("id")
    .eq("id", input.exerciseId)
    .maybeSingle();
  if (exerciseError) return { ok: false, error: exerciseError.message };
  if (!exerciseRow) return { ok: false, error: "Exercise not found." };

  for (const day of daysOfWeek) {
    const { data: alreadyTouched, error: touchedError } = await supabase
      .from("workout_plan_items")
      .select("id")
      .eq("workout_plan_id", plan.id)
      .eq("day_of_week", day)
      .eq("substituted", true)
      .limit(1)
      .maybeSingle();
    if (touchedError) return { ok: false, error: touchedError.message };

    if (!alreadyTouched) {
      const { error: deleteError } = await supabase
        .from("workout_plan_items")
        .delete()
        .eq("workout_plan_id", plan.id)
        .eq("day_of_week", day);
      if (deleteError) return { ok: false, error: `Failed to clear that day's plan: ${deleteError.message}` };
    }

    const { data: lastItem, error: lastItemError } = await supabase
      .from("workout_plan_items")
      .select("session_order")
      .eq("workout_plan_id", plan.id)
      .eq("day_of_week", day)
      .order("session_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastItemError) return { ok: false, error: lastItemError.message };
    const nextOrder = (lastItem?.session_order ?? -1) + 1;

    const { error: insertError } = await supabase.from("workout_plan_items").insert({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: day,
      session_order: nextOrder,
      exercise_id: exerciseRow.id,
      sets: input.sets,
      reps: input.reps,
      duration_minutes: input.durationMinutes,
      program_session_exercise_id: null,
      reps_min: null,
      reps_max: null,
      intensity_type: null,
      intensity_value: null,
      cardio_intensity: null,
      coaching_notes: null,
      substituted: true,
    });
    if (insertError) return { ok: false, error: `Failed to assign the exercise: ${insertError.message}` };
  }

  const { error: historyError } = await supabase.from("exercise_pick_history").insert(
    daysOfWeek.map((day) => ({
      user_id: userId,
      exercise_id: input.exerciseId,
      session_id: null,
      week_start: weekStart,
      day_of_week: day,
    }))
  );

  const warnings = [...bootstrap.warnings];
  if (historyError) warnings.push(`Preference tracking failed: ${historyError.message}`);
  return { ok: true, data: { warnings } };
}
