"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type {
  TrainingProgram,
  TrainingProgramPhase,
  ProgramSession,
  ProgramSessionExercise,
  HydratedProgramPhase,
  ProgramSource,
} from "@/domains/trainingprogram/types";

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

function toSession(row: Database["public"]["Tables"]["program_sessions"]["Row"]): ProgramSession {
  return {
    id: row.id,
    phaseId: row.phase_id,
    sessionIndex: row.session_index,
    name: row.name,
    sessionType: row.session_type,
  };
}

function toSessionExercise(
  row: Database["public"]["Tables"]["program_session_exercises"]["Row"]
): ProgramSessionExercise {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseOrder: row.exercise_order,
    exerciseId: row.exercise_id,
    sets: row.sets,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    intensityType: row.intensity_type as ProgramSessionExercise["intensityType"],
    intensityValue: row.intensity_value,
    durationMinutes: row.duration_minutes,
    cardioIntensity: row.cardio_intensity,
    coachingNotes: row.coaching_notes,
    primaryExerciseId: row.primary_exercise_id,
  };
}

/**
 * Candidate programs for a rotation decision (domains/workoutplan/rotation.ts
 * filters/selects from this list) -- active programs for the archetype,
 * unfiltered by equipment/experience/session-count here since rotation.ts
 * owns the progressive-relaxation logic, mirroring generate.ts's own
 * archetype-then-equipment relaxation pattern.
 */
export async function getEligibleProgramCandidates(
  archetype: string,
  client?: SupabaseClient<Database>
): Promise<TrainingProgram[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .eq("archetype", archetype)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load training programs: ${error.message}`);
  }

  return (data ?? []).map(toProgram);
}

export async function getFirstPhaseId(
  programId: string,
  client?: SupabaseClient<Database>
): Promise<string | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("training_program_phases")
    .select("id")
    .eq("program_id", programId)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load first phase: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function getPhaseById(
  phaseId: string,
  client?: SupabaseClient<Database>
): Promise<TrainingProgramPhase | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("training_program_phases")
    .select("*")
    .eq("id", phaseId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load phase: ${error.message}`);
  }

  return data ? toPhase(data) : null;
}

/** Finds the phase that follows the given one within the same program, in
 * phase_order sequence -- null if the given phase is already the last one. */
export async function getNextPhase(
  currentPhase: TrainingProgramPhase,
  client?: SupabaseClient<Database>
): Promise<TrainingProgramPhase | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("training_program_phases")
    .select("*")
    .eq("program_id", currentPhase.programId)
    .gt("phase_order", currentPhase.phaseOrder)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load next phase: ${error.message}`);
  }

  return data ? toPhase(data) : null;
}

/**
 * Loads a phase with every session and each session's exercise
 * prescriptions, ready for domains/workoutplan/generate.ts's
 * materializeWorkoutPlan() to turn into a concrete week of workout_plan_items.
 * Only recommended/default prescriptions come back (primary_exercise_id
 * is null) -- alternates are looked up separately, per plan item, via
 * getAlternateOptions(), so materialization needs no awareness of them.
 */
export async function getProgramPhaseHydrated(
  phaseId: string,
  client?: SupabaseClient<Database>
): Promise<HydratedProgramPhase | null> {
  const supabase = client ?? (await createClient());

  const { data: phaseRow, error: phaseError } = await supabase
    .from("training_program_phases")
    .select("*")
    .eq("id", phaseId)
    .maybeSingle();

  if (phaseError) {
    throw new Error(`Failed to load phase: ${phaseError.message}`);
  }
  if (!phaseRow) return null;

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("phase_id", phaseId)
    .order("session_index", { ascending: true });

  if (sessionsError) {
    throw new Error(`Failed to load program sessions: ${sessionsError.message}`);
  }

  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const exercisesBySession = new Map<string, ProgramSessionExercise[]>();

  if (sessionIds.length > 0) {
    const { data: exerciseRows, error: exercisesError } = await supabase
      .from("program_session_exercises")
      .select("*")
      .in("session_id", sessionIds)
      .is("primary_exercise_id", null)
      .order("exercise_order", { ascending: true });

    if (exercisesError) {
      throw new Error(`Failed to load session exercises: ${exercisesError.message}`);
    }

    for (const row of exerciseRows ?? []) {
      const list = exercisesBySession.get(row.session_id) ?? [];
      list.push(toSessionExercise(row));
      exercisesBySession.set(row.session_id, list);
    }
  }

  return {
    ...toPhase(phaseRow),
    sessions: (sessionRows ?? []).map((row) => ({
      ...toSession(row),
      exercises: exercisesBySession.get(row.id) ?? [],
    })),
  };
}

/** A single prescription row by id -- used when validating/applying a
 * swap (domains/workoutplan/service.ts's swapWorkoutPlanItemExercise). */
export async function getSessionExerciseById(
  id: string,
  client?: SupabaseClient<Database>
): Promise<ProgramSessionExercise | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("program_session_exercises").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load session exercise: ${error.message}`);
  }

  return data ? toSessionExercise(data) : null;
}

async function getSessionExercisesByIds(
  ids: string[],
  client?: SupabaseClient<Database>
): Promise<Map<string, ProgramSessionExercise>> {
  const map = new Map<string, ProgramSessionExercise>();
  if (ids.length === 0) return map;

  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("program_session_exercises").select("*").in("id", ids);

  if (error) {
    throw new Error(`Failed to load session exercises: ${error.message}`);
  }

  for (const row of data ?? []) map.set(row.id, toSessionExercise(row));
  return map;
}

/**
 * For a batch of "current selection" prescription ids (whatever a plan
 * item currently points to -- the recommended default, or a previously
 * chosen alternate), returns every *other* option for that same slot,
 * keyed by the current-selection id. Deliberately resolves back to the
 * slot's recommended default and includes it too when the current
 * selection is itself an alternate -- otherwise a user who already
 * swapped away from the default would have no way to swap back to it,
 * since an alternate never lists its own primary among its siblings.
 * Two batched queries total, not N+1 per item.
 */
export async function getSlotOptions(
  currentPrescriptionIds: string[],
  client?: SupabaseClient<Database>
): Promise<Map<string, ProgramSessionExercise[]>> {
  const result = new Map<string, ProgramSessionExercise[]>();
  if (currentPrescriptionIds.length === 0) return result;

  const supabase = client ?? (await createClient());
  const currentRows = await getSessionExercisesByIds(currentPrescriptionIds, supabase);

  const slotPrimaryIdByCurrentId = new Map<string, string>();
  const slotPrimaryIds = new Set<string>();
  for (const id of currentPrescriptionIds) {
    const slotPrimaryId = currentRows.get(id)?.primaryExerciseId ?? id;
    slotPrimaryIdByCurrentId.set(id, slotPrimaryId);
    slotPrimaryIds.add(slotPrimaryId);
  }

  const [primaryRows, { data: alternateRows, error }] = await Promise.all([
    getSessionExercisesByIds(Array.from(slotPrimaryIds), supabase),
    supabase.from("program_session_exercises").select("*").in("primary_exercise_id", Array.from(slotPrimaryIds)),
  ]);
  if (error) {
    throw new Error(`Failed to load alternate exercises: ${error.message}`);
  }

  const alternatesBySlotPrimaryId = new Map<string, ProgramSessionExercise[]>();
  for (const row of alternateRows ?? []) {
    if (!row.primary_exercise_id) continue;
    const list = alternatesBySlotPrimaryId.get(row.primary_exercise_id) ?? [];
    list.push(toSessionExercise(row));
    alternatesBySlotPrimaryId.set(row.primary_exercise_id, list);
  }

  for (const id of currentPrescriptionIds) {
    const slotPrimaryId = slotPrimaryIdByCurrentId.get(id) as string;
    const primaryRow = primaryRows.get(slotPrimaryId);
    const allOptions = [...(primaryRow ? [primaryRow] : []), ...(alternatesBySlotPrimaryId.get(slotPrimaryId) ?? [])];
    result.set(
      id,
      allOptions.filter((opt) => opt.id !== id)
    );
  }

  return result;
}

function toSource(row: Database["public"]["Tables"]["program_sources"]["Row"]): ProgramSource {
  return {
    id: row.id,
    programId: row.program_id,
    organization: row.organization,
    title: row.title,
    url: row.url,
    retrievedAt: row.retrieved_at,
  };
}

/** A program's citation trail (the on-demand content pipeline's
 * credibility gate writes these alongside each program it generates --
 * see docs/training-content-pipeline.md). */
export async function getProgramSources(
  programId: string,
  client?: SupabaseClient<Database>
): Promise<ProgramSource[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("program_sources")
    .select("*")
    .eq("program_id", programId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load program sources: ${error.message}`);
  }

  return (data ?? []).map(toSource);
}
