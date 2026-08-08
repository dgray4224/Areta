/**
 * One-off, disposable verification of the training_programs rotation +
 * materialization pipeline against the LIVE database (real seeded
 * programs/exercises, not fixtures) -- covers the scenarios called for in
 * the Exercise Tab Redesign plan's verification section: fresh user,
 * mid-phase continuation, phase-boundary advance, program-boundary
 * rotation, and exhausted-pool fallback, across 2 archetypes (one
 * original, one new).
 *
 * Creates a single disposable auth user + profile + onboarding_responses +
 * generated_parameters rows, all deleted at the end (deleteUser cascades
 * the rest). Never writes to workout_plans/workout_plan_items -- this
 * only exercises the selection/hydration/materialization functions and
 * prints their output, it doesn't persist a generated plan.
 *
 * Invoke with: pnpm dlx tsx scripts/verify-training-programs.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
// NOT importing domains/trainingprogram/service.ts here -- like
// admin-client.ts, this script runs via plain tsx outside Next.js, and
// that file (like every domain service) unconditionally imports
// platform/supabase/server, which imports "server-only" and throws
// immediately outside Next's bundler. rotation.ts and generate.ts are
// pure/DB-free so they're safe to import directly; the handful of small
// queries trainingprogram/service.ts would normally provide are inlined
// below instead.
import { selectProgram, resolveProgression, type LastWorkoutPlanInfo } from "@/domains/workoutplan/rotation";
import { materializeWorkoutPlan } from "@/domains/workoutplan/generate";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { TrainingProgram, TrainingProgramPhase, HydratedProgramPhase } from "@/domains/trainingprogram/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

const TEST_EMAIL = `throwaway-verify-${Date.now()}@example.test`;

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

async function getPhaseById(phaseId: string, supabase: SupabaseClient<Database>): Promise<TrainingProgramPhase | null> {
  const { data, error } = await supabase.from("training_program_phases").select("*").eq("id", phaseId).maybeSingle();
  if (error) throw error;
  return data ? toPhase(data) : null;
}

async function getNextPhase(currentPhase: TrainingProgramPhase, supabase: SupabaseClient<Database>): Promise<TrainingProgramPhase | null> {
  const { data, error } = await supabase
    .from("training_program_phases")
    .select("*")
    .eq("program_id", currentPhase.programId)
    .gt("phase_order", currentPhase.phaseOrder)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toPhase(data) : null;
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
    movementPatterns: [],
    modality: null,
    limitationTags: [],
    compound: false,
  }));
}

async function runScenario(opts: {
  label: string;
  supabase: SupabaseClient<Database>;
  exercises: Exercise[];
  archetype: string;
  equipmentAccess: string[];
  experienceLevel: "beginner" | "intermediate" | "advanced";
  sessionsPerWeek: number;
  usedProgramIds: string[];
  lastUsedByProgramId: Map<string, string>;
  lastPlan: LastWorkoutPlanInfo | null;
  currentPhase: TrainingProgramPhase | null;
  nextPhase: TrainingProgramPhase | null;
  newWeekStart: string;
}): Promise<{ programId: string; phaseId: string } | null> {
  const {
    label,
    supabase,
    exercises,
    archetype,
    equipmentAccess,
    experienceLevel,
    sessionsPerWeek,
    usedProgramIds,
    lastUsedByProgramId,
    lastPlan,
    currentPhase,
    nextPhase,
    newWeekStart,
  } = opts;

  const decision = resolveProgression({ lastPlan, currentArchetype: archetype, newWeekStart, currentPhase, nextPhase });
  console.log(`  [${label}] decision: ${JSON.stringify(decision)}`);

  let programId: string;
  let phaseId: string | null;

  if (decision.kind === "continue_phase" || decision.kind === "advance_phase") {
    programId = decision.programId;
    phaseId = decision.phaseId;
  } else {
    const candidates = await getEligibleProgramCandidates(archetype, supabase);
    const { program, warnings } = selectProgram({
      userId: "throwaway-verify-user",
      archetype,
      candidates,
      equipmentAccess,
      experienceLevel,
      sessionsPerWeek,
      usedProgramIds,
      lastUsedByProgramId,
    });
    if (warnings.length > 0) console.log(`    warnings: ${warnings.join(" | ")}`);
    if (!program) {
      console.log("    NO PROGRAM FOUND -- would fall back to legacy generateWorkoutPlan");
      return null;
    }
    programId = program.id;
    phaseId = await getFirstPhaseId(program.id, supabase);
    console.log(`    selected program: "${program.name}" (${program.slug})`);
  }

  if (!phaseId) {
    console.log("    FAILED: no phase id resolved");
    return null;
  }

  const hydrated = await getProgramPhaseHydrated(phaseId, supabase);
  if (!hydrated) {
    console.log("    FAILED to hydrate phase");
    return null;
  }

  const result = materializeWorkoutPlan({ phase: hydrated, archetype, equipmentAccess, exercises, sessionsPerWeek });
  const totalExercises = result.days.reduce((sum, d) => sum + d.exercises.length, 0);
  const substitutedCount = result.days.reduce(
    (sum, d) => sum + d.exercises.filter((e) => e.substituted).length,
    0
  );
  console.log(
    `    phase: "${hydrated.name}" (isFinal=${hydrated.isFinal}, lengthWeeks=${hydrated.lengthWeeks}), ` +
      `sessions=${hydrated.sessions.length}, materialized=${totalExercises} exercises, substituted=${substitutedCount}, ` +
      `warnings=${result.warnings.length}${result.warnings.length ? " (" + result.warnings.join(" | ") + ")" : ""}`
  );

  return { programId, phaseId };
}

async function verifyArchetype(supabase: SupabaseClient<Database>, exercises: Exercise[], archetype: string) {
  console.log(`\n=== ${archetype} ===`);
  const equipmentAccess = ["Full gym access"];
  const experienceLevel = "intermediate" as const;
  const sessionsPerWeek = 4;

  // Scenario 1: fresh user, no history at all.
  await runScenario({
    label: "fresh (no history)",
    supabase,
    exercises,
    archetype,
    equipmentAccess,
    experienceLevel,
    sessionsPerWeek,
    usedProgramIds: [],
    lastUsedByProgramId: new Map(),
    lastPlan: null,
    currentPhase: null,
    nextPhase: null,
    newWeekStart: "2026-08-03",
  });

  const candidates = await getEligibleProgramCandidates(archetype, supabase);
  if (candidates.length === 0) {
    console.log("  No candidates found for this archetype -- skipping remaining scenarios.");
    return;
  }
  const programA = candidates[0];
  const firstPhaseId = await getFirstPhaseId(programA.id, supabase);
  if (!firstPhaseId) {
    console.log("  Program has no phases -- skipping remaining scenarios.");
    return;
  }
  const firstPhase = await getPhaseById(firstPhaseId, supabase);
  if (!firstPhase) return;
  const secondPhase = await getNextPhase(firstPhase, supabase);

  // Scenario 2: mid-phase continuation (week 1 of a multi-week phase).
  await runScenario({
    label: "mid-phase continuation",
    supabase,
    exercises,
    archetype,
    equipmentAccess,
    experienceLevel,
    sessionsPerWeek,
    usedProgramIds: [programA.id],
    lastUsedByProgramId: new Map([[programA.id, "2026-07-27"]]),
    lastPlan: {
      programId: programA.id,
      programArchetype: archetype,
      phaseId: firstPhase.id,
      phaseWeekNumber: 1,
      weekStart: "2026-07-27",
    },
    currentPhase: firstPhase,
    nextPhase: secondPhase,
    newWeekStart: "2026-08-03",
  });

  // Scenario 3: phase boundary (last week of phase 1, phase 2 exists).
  if (secondPhase) {
    const result = await runScenario({
      label: "phase-boundary advance",
      supabase,
      exercises,
      archetype,
      equipmentAccess,
      experienceLevel,
      sessionsPerWeek,
      usedProgramIds: [programA.id],
      lastUsedByProgramId: new Map([[programA.id, "2026-07-27"]]),
      lastPlan: {
        programId: programA.id,
        programArchetype: archetype,
        phaseId: firstPhase.id,
        phaseWeekNumber: firstPhase.lengthWeeks,
        weekStart: "2026-07-27",
      },
      currentPhase: firstPhase,
      nextPhase: secondPhase,
      newWeekStart: "2026-08-03",
    });
    if (result?.phaseId !== secondPhase.id) {
      console.log(`    !! expected to advance to phase ${secondPhase.id}, got ${result?.phaseId}`);
    }
  }

  // Scenario 4: program boundary (final phase's weeks exhausted -> rotate).
  let cursor: TrainingProgramPhase = firstPhase;
  while (!cursor.isFinal) {
    const next = await getNextPhase(cursor, supabase);
    if (!next) break;
    cursor = next;
  }
  const finalPhase = cursor;
  const rotationResult = await runScenario({
    label: "program-boundary rotation",
    supabase,
    exercises,
    archetype,
    equipmentAccess,
    experienceLevel,
    sessionsPerWeek,
    usedProgramIds: [programA.id],
    lastUsedByProgramId: new Map([[programA.id, "2026-07-27"]]),
    lastPlan: {
      programId: programA.id,
      programArchetype: archetype,
      phaseId: finalPhase.id,
      phaseWeekNumber: finalPhase.lengthWeeks,
      weekStart: "2026-07-27",
    },
    currentPhase: finalPhase,
    nextPhase: null,
    newWeekStart: "2026-08-03",
  });
  if (rotationResult?.programId === programA.id && candidates.length > 1) {
    console.log(`    !! expected rotation away from ${programA.id}, but got the same program back`);
  }

  // Scenario 5: exhausted pool -- every candidate already used, falls back to LRU.
  const lastUsedMap = new Map(candidates.map((c, i) => [c.id, `2026-0${(i % 6) + 1}-01`]));
  await runScenario({
    label: "exhausted pool (LRU fallback)",
    supabase,
    exercises,
    archetype,
    equipmentAccess,
    experienceLevel,
    sessionsPerWeek,
    usedProgramIds: candidates.map((c) => c.id),
    lastUsedByProgramId: lastUsedMap,
    lastPlan: null,
    currentPhase: null,
    nextPhase: null,
    newWeekStart: "2026-08-03",
  });
}

async function main() {
  const supabase = createScriptAdminClient();
  let userId: string | undefined;

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: `throwaway-${Date.now()}!Aa1`,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Failed to create throwaway user");
    userId = data.user.id;
    console.log(`Created throwaway user: ${TEST_EMAIL} (${userId})`);

    const { error: profileError } = await supabase.from("profiles").insert({ id: userId });
    if (profileError) throw profileError;

    const exercises = await loadExercises(supabase);
    console.log(`Loaded ${exercises.length} exercises from the live library.`);

    await verifyArchetype(supabase, exercises, "powerlifter");
    await verifyArchetype(supabase, exercises, "olympic_weightlifter");

    console.log("\nAll scenarios completed.");
  } finally {
    if (userId) {
      await supabase.from("onboarding_responses").delete().eq("user_id", userId);
      await supabase.from("generated_parameters").delete().eq("user_id", userId);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error(`WARNING: failed to delete throwaway user ${userId}: ${deleteError.message}`);
      } else {
        console.log(`Cleaned up throwaway user ${userId}.`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
