/**
 * TEMPORARY stop-gap, not part of the real pipeline: assigns a specific
 * user directly onto a named active training_programs slug, bypassing
 * onboarding_responses entirely. Exists only because goal-first-onboarded
 * users (isLegacyExerciseShape() === false) have no real plan-generation
 * path yet (see domains/workoutplan/service.ts's Phase 4 TODO) -- this is
 * a deliberate, temporary workaround requested by the user on 2026-08-06
 * to unblock simulator testing, not a fix for that gap. Delete once
 * goal-first plan generation ships.
 *
 * Invoke: pnpm dlx tsx scripts/dev-stopgap-hybrid-plan.ts <user-email> <program-slug> <sessions-per-week>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { materializeWorkoutPlan } from "@/domains/workoutplan/generate";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { TrainingProgramPhase, HydratedProgramPhase } from "@/domains/trainingprogram/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

function toPhase(row: Database["public"]["Tables"]["training_program_phases"]["Row"]): TrainingProgramPhase {
  return {
    id: row.id,
    programId: row.program_id,
    phaseOrder: row.phase_order,
    name: row.name,
    focus: row.focus,
    lengthWeeks: row.length_weeks,
    intensityStyle: row.intensity_style,
    isFinal: row.is_final,
  };
}

async function getProgramPhaseHydrated(phaseId: string, supabase: SupabaseClient<Database>): Promise<HydratedProgramPhase | null> {
  const { data: phaseRow, error: phaseError } = await supabase.from("training_program_phases").select("*").eq("id", phaseId).maybeSingle();
  if (phaseError) throw phaseError;
  if (!phaseRow) return null;

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("phase_id", phaseId)
    .order("session_index", { ascending: true });
  if (sessionsError) throw sessionsError;

  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const exercisesBySession = new Map<string, HydratedProgramPhase["sessions"][number]["exercises"]>();

  if (sessionIds.length > 0) {
    const { data: exerciseRows, error: exercisesError } = await supabase
      .from("program_session_exercises")
      .select("*")
      .in("session_id", sessionIds)
      .is("primary_exercise_id", null)
      .order("exercise_order", { ascending: true });
    if (exercisesError) throw exercisesError;

    for (const row of exerciseRows ?? []) {
      const list = exercisesBySession.get(row.session_id) ?? [];
      list.push({
        id: row.id,
        sessionId: row.session_id,
        exerciseOrder: row.exercise_order,
        exerciseId: row.exercise_id,
        sets: row.sets,
        repsMin: row.reps_min,
        repsMax: row.reps_max,
        intensityType: row.intensity_type as HydratedProgramPhase["sessions"][number]["exercises"][number]["intensityType"],
        intensityValue: row.intensity_value,
        durationMinutes: row.duration_minutes,
        cardioIntensity: row.cardio_intensity,
        coachingNotes: row.coaching_notes,
        primaryExerciseId: row.primary_exercise_id,
      });
      exercisesBySession.set(row.session_id, list);
    }
  }

  return {
    ...toPhase(phaseRow),
    sessions: (sessionRows ?? []).map((row) => ({
      id: row.id,
      phaseId: row.phase_id,
      sessionIndex: row.session_index,
      name: row.name,
      sessionType: row.session_type,
      exercises: exercisesBySession.get(row.id) ?? [],
    })),
  };
}

async function loadExercises(supabase: SupabaseClient<Database>): Promise<Exercise[]> {
  const { data, error } = await supabase.from("exercises").select("*");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    movementPattern: row.movement_pattern,
    equipmentRequired: row.equipment_required,
    archetypeTags: row.archetype_tags,
    difficulty: row.difficulty as Exercise["difficulty"],
    primaryMuscleGroups: row.primary_muscle_groups,
    instructions: row.instructions,
  }));
}

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const [email, programSlug, sessionsArg] = process.argv.slice(2);
  if (!email || !programSlug || !sessionsArg) {
    console.error("Usage: tsx scripts/dev-stopgap-hybrid-plan.ts <user-email> <program-slug> <sessions-per-week>");
    process.exit(1);
  }
  const sessionsPerWeek = Number(sessionsArg);

  const supabase = createScriptAdminClient();

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user found with email ${email}`);
  const userId = user.id;

  const { data: programRow, error: programError } = await supabase
    .from("training_programs")
    .select("id, archetype, equipment_required, is_active")
    .eq("slug", programSlug)
    .maybeSingle();
  if (programError || !programRow) throw new Error(`Program slug ${programSlug} not found: ${programError?.message}`);
  if (!programRow.is_active) throw new Error(`Program ${programSlug} is not active.`);

  const { data: firstPhaseRow, error: firstPhaseError } = await supabase
    .from("training_program_phases")
    .select("id")
    .eq("program_id", programRow.id)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstPhaseError || !firstPhaseRow) throw new Error(`No phases found for ${programSlug}: ${firstPhaseError?.message}`);

  const exercises = await loadExercises(supabase);
  const hydrated = await getProgramPhaseHydrated(firstPhaseRow.id, supabase);
  if (!hydrated) throw new Error("Failed to hydrate phase.");

  const result = materializeWorkoutPlan({
    phase: hydrated,
    archetype: programRow.archetype,
    equipmentAccess: programRow.equipment_required,
    exercises,
    sessionsPerWeek,
  });

  const weekStart = currentWeekStart();
  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        status: "active",
        sessions_per_week: sessionsPerWeek,
        phase_focus: hydrated.focus,
        program_id: programRow.id,
        program_phase_id: firstPhaseRow.id,
        phase_week_number: 1,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();
  if (planError || !plan) throw new Error(`Failed to save workout plan: ${planError?.message}`);

  await supabase.from("workout_plan_items").delete().eq("workout_plan_id", plan.id);

  const items = result.days.flatMap((day, dayIndex) =>
    day.exercises.map((ex, index) => ({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: dayIndex,
      session_order: index,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      duration_minutes: ex.durationMinutes,
      program_session_exercise_id: ex.programSessionExerciseId,
      reps_min: ex.repsMin,
      reps_max: ex.repsMax,
      intensity_type: ex.intensityType,
      intensity_value: ex.intensityValue,
      cardio_intensity: ex.cardioIntensity,
      coaching_notes: ex.coachingNotes,
      substituted: ex.substituted,
    }))
  );
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("workout_plan_items").insert(items);
    if (itemsError) throw itemsError;
  }

  console.log(`Saved active workout plan ${plan.id} for ${email} on program ${programSlug}, week ${weekStart}: ${items.length} planned exercises across ${result.days.filter((d) => !d.isRestDay).length} sessions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
