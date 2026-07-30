"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { getApprovedParameterValue, getGeneratedParameters } from "@/domains/parameters/service";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { generateWorkoutPlan } from "@/domains/workoutplan/generate";
import type { ExerciseInput } from "@/domains/exercise/schema";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Generates a fresh weekly workout schedule as a draft from the user's
 * approved Exercise parameters, stated equipment access, and the shared
 * exercise library. Mirrors domains/mealplan/service.ts's
 * generateAndSaveMealPlan. Still needs an explicit approve step (see
 * approveWorkoutPlan) before it's "active" (CLAUDE.md rule 10).
 */
export async function generateAndSaveWorkoutPlan(userId: string): Promise<ActionResult<{ warnings: string[] }>> {
  const [sessionsPerWeek, parameters, { data: responses }] = await Promise.all([
    getApprovedParameterValue(userId, "exercise", "sessions_per_week"),
    getGeneratedParameters(userId, "exercise"),
    (await createClient())
      .from("onboarding_responses")
      .select("exercise")
      .eq("user_id", userId)
      .single(),
  ]);

  if (sessionsPerWeek === null) {
    return { ok: false, error: "Approve your training parameters before generating a workout plan." };
  }

  const exercise = (responses?.exercise ?? {}) as ExerciseInput;
  if (!exercise.archetype) {
    return { ok: false, error: "Complete the Exercise onboarding step before generating a workout plan." };
  }

  const primaryFocusParam = parameters.find((p) => p.id === "primary_focus" && p.approved);
  const phaseFocus = typeof primaryFocusParam?.value === "string" ? primaryFocusParam.value : null;

  const exercises = await getAllExercises();

  const { days, warnings } = generateWorkoutPlan({
    sessionsPerWeek,
    archetype: exercise.archetype,
    equipmentAccess: exercise.equipmentAccess ?? [],
    exercises,
  });

  const supabase = await createClient();
  const weekStart = currentWeekStart();

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        status: "draft",
        sessions_per_week: sessionsPerWeek,
        phase_focus: phaseFocus,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();

  if (planError || !plan) {
    return { ok: false, error: `Failed to save workout plan: ${planError?.message}` };
  }

  const { error: deleteError } = await supabase
    .from("workout_plan_items")
    .delete()
    .eq("workout_plan_id", plan.id);
  if (deleteError) {
    return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };
  }

  const items = days.flatMap((day) =>
    day.exercises.map((ex, index) => ({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: day.dayOfWeek,
      session_order: index,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      duration_minutes: ex.durationMinutes,
    }))
  );

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("workout_plan_items").insert(items);
    if (itemsError) {
      return { ok: false, error: `Failed to save workout plan items: ${itemsError.message}` };
    }
  }

  return { ok: true, data: { warnings } };
}

export async function approveWorkoutPlan(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const weekStart = currentWeekStart();
  const { error } = await supabase
    .from("workout_plans")
    .update({ status: "active" })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export type WorkoutPlanItemView = {
  id: string;
  dayOfWeek: number;
  sessionOrder: number;
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
};

export type WorkoutPlanView = {
  id: string;
  weekStart: string;
  status: "draft" | "active" | "archived";
  sessionsPerWeek: number | null;
  phaseFocus: string | null;
  items: WorkoutPlanItemView[];
};

export async function getWorkoutPlanForWeek(
  userId: string,
  weekStart = currentWeekStart()
): Promise<WorkoutPlanView | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, week_start, status, sessions_per_week, phase_focus")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan) return null;

  const { data: items, error } = await supabase
    .from("workout_plan_items")
    .select("id, day_of_week, session_order, exercise_id, sets, reps, duration_minutes")
    .eq("workout_plan_id", plan.id)
    .order("day_of_week", { ascending: true })
    .order("session_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout plan items: ${error.message}`);
  }

  return {
    id: plan.id,
    weekStart: plan.week_start,
    status: plan.status as WorkoutPlanView["status"],
    sessionsPerWeek: plan.sessions_per_week,
    phaseFocus: plan.phase_focus,
    items: (items ?? []).map((i) => ({
      id: i.id,
      dayOfWeek: i.day_of_week,
      sessionOrder: i.session_order,
      exerciseId: i.exercise_id,
      sets: i.sets,
      reps: i.reps,
      durationMinutes: i.duration_minutes,
    })),
  };
}

export async function getActiveWorkoutPlan(userId: string): Promise<WorkoutPlanView | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, week_start, status, sessions_per_week, phase_focus")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;
  return getWorkoutPlanForWeek(userId, plan.week_start);
}
