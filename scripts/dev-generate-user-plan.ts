/**
 * One-off dev utility: regenerates a real user's workout plan through the
 * new training_programs system, using their own already-set-and-approved
 * Exercise onboarding answers (does not modify onboarding or parameters).
 * Same admin-client reimplementation of generateAndSaveWorkoutPlan's
 * orchestration as scripts/dev-generate-founder-plan.ts, for the same
 * reason (this runs outside Next.js via plain tsx).
 *
 * Invoke: pnpm dlx tsx scripts/dev-generate-user-plan.ts <user-email>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { generateWorkoutPlan, materializeWorkoutPlan } from "@/domains/workoutplan/generate";
import { selectProgram, resolveProgression, type LastWorkoutPlanInfo } from "@/domains/workoutplan/rotation";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { TrainingProgram, TrainingProgramPhase, HydratedProgramPhase } from "@/domains/trainingprogram/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { isLegacyExerciseShape } from "@/domains/exercise/legacy";

function toProgram(row: Database["public"]["Tables"]["training_programs"]["Row"]): TrainingProgram {
  return {
    id: row.id,
    archetype: row.archetype,
    slug: row.slug,
    name: row.name,
    description: row.description,
    methodologyNote: row.methodology_note,
    experienceLevel: row.experience_level as TrainingProgram["experienceLevel"],
    sessionsPerWeekMin: row.sessions_per_week_min,
    sessionsPerWeekMax: row.sessions_per_week_max,
    equipmentRequired: row.equipment_required,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

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

async function getEligibleProgramCandidates(archetype: string, supabase: SupabaseClient<Database>): Promise<TrainingProgram[]> {
  const { data, error } = await supabase.from("training_programs").select("*").eq("archetype", archetype).eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map(toProgram);
}

async function getFirstPhaseId(programId: string, supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await supabase
    .from("training_program_phases")
    .select("id")
    .eq("program_id", programId)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
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
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/dev-generate-user-plan.ts <user-email>");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user found with email ${email}`);
  const userId = user.id;

  const { data: responses } = await supabase.from("onboarding_responses").select("exercise").eq("user_id", userId).maybeSingle();
  const exercise = responses?.exercise ?? {};
  if (!isLegacyExerciseShape(exercise) || !exercise.archetype) {
    throw new Error(
      `User ${email} has no exercise.archetype set in onboarding_responses (either empty, or already re-onboarded in the new goal-first shape -- this dev script only supports the old archetype-first pipeline until Phase 4).`
    );
  }
  const archetype = exercise.archetype;
  const equipmentAccess = exercise.equipmentAccess ?? [];
  const experienceLevel = exercise.experienceLevel ?? "beginner";

  const { data: paramRow } = await supabase
    .from("generated_parameters")
    .select("value, approved")
    .eq("user_id", userId)
    .eq("domain", "exercise")
    .eq("name", "sessions_per_week")
    .maybeSingle();
  if (!paramRow?.approved) throw new Error(`User ${email} has no approved sessions_per_week parameter.`);
  const sessionsPerWeek = paramRow.value as number;

  console.log(`User: ${email} (${userId})`);
  console.log(`archetype=${archetype}, sessionsPerWeek=${sessionsPerWeek}, experienceLevel=${experienceLevel}, equipment=[${equipmentAccess.join(", ")}]`);

  const weekStart = currentWeekStart();
  const exercises = await loadExercises(supabase);
  const candidates = await getEligibleProgramCandidates(archetype, supabase);

  const { data: lastPlanRow } = await supabase
    .from("workout_plans")
    .select("program_id, program_phase_id, phase_week_number, week_start")
    .eq("user_id", userId)
    .not("program_id", "is", null)
    .lt("week_start", weekStart)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lastPlan: LastWorkoutPlanInfo | null = null;
  let currentPhase: TrainingProgramPhase | null = null;
  if (lastPlanRow?.program_id && lastPlanRow.program_phase_id && lastPlanRow.phase_week_number !== null) {
    const { data: phaseRow } = await supabase.from("training_program_phases").select("*").eq("id", lastPlanRow.program_phase_id).maybeSingle();
    const { data: programRow } = await supabase.from("training_programs").select("archetype").eq("id", lastPlanRow.program_id).maybeSingle();
    if (phaseRow && programRow) {
      currentPhase = toPhase(phaseRow);
      lastPlan = {
        programId: lastPlanRow.program_id,
        programArchetype: programRow.archetype,
        phaseId: lastPlanRow.program_phase_id,
        phaseWeekNumber: lastPlanRow.phase_week_number,
        weekStart: lastPlanRow.week_start,
      };
    }
  }

  const decision = resolveProgression({ lastPlan, currentArchetype: archetype, newWeekStart: weekStart, currentPhase, nextPhase: null });
  let programId: string | null = null;
  let phaseId: string | null = null;

  if (decision.kind === "continue_phase" || decision.kind === "advance_phase") {
    programId = decision.programId;
    phaseId = decision.phaseId;
  } else {
    const { program, warnings } = selectProgram({
      userId,
      archetype,
      candidates,
      equipmentAccess,
      experienceLevel,
      sessionsPerWeek,
      usedProgramIds: [],
      lastUsedByProgramId: new Map(),
    });
    if (warnings.length) console.log(`selectProgram warnings: ${warnings.join(" | ")}`);
    if (program) {
      programId = program.id;
      phaseId = await getFirstPhaseId(program.id, supabase);
    }
  }

  let days: ReturnType<typeof generateWorkoutPlan>["days"] = [];
  let phaseFocus: string | null = null;
  if (phaseId) {
    const hydrated = await getProgramPhaseHydrated(phaseId, supabase);
    if (hydrated) {
      const result = materializeWorkoutPlan({ phase: hydrated, archetype, equipmentAccess, exercises, sessionsPerWeek });
      days = result.days;
      phaseFocus = hydrated.focus;
      console.log(`Materialized from phase "${hydrated.name}" (program ${programId})`);
    }
  }
  if (days.length === 0) {
    console.log("No program phase materialized -- falling back to legacy generator.");
    const result = generateWorkoutPlan({ sessionsPerWeek, archetype, equipmentAccess, exercises });
    days = result.days;
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        status: "active",
        sessions_per_week: sessionsPerWeek,
        phase_focus: phaseFocus,
        program_id: programId,
        program_phase_id: phaseId,
        phase_week_number: phaseId ? 1 : null,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();
  if (planError || !plan) throw new Error(`Failed to save workout plan: ${planError?.message}`);

  await supabase.from("workout_plan_items").delete().eq("workout_plan_id", plan.id);

  const items = days.flatMap((day, dayIndex) =>
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

  console.log(`Saved active workout plan ${plan.id} for week ${weekStart}: ${items.length} planned exercises across ${days.filter((d) => !d.isRestDay).length} sessions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
