"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { requireTrainer } from "@/platform/auth/trainer";
import { logAdminAction } from "@/platform/audit/log";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import {
  trainerProgramSchema,
  trainerProgramPhaseSchema,
  trainerProgramSessionSchema,
  trainerProgramSessionExerciseSchema,
  trainerExerciseSchema,
} from "@/domains/trainerprogram/schema";
import type {
  TrainerProgram,
  TrainerProgramPhase,
  TrainerProgramSession,
  TrainerProgramSessionExercise,
  HydratedTrainerProgramPhase,
  TrainerProgramWithPhases,
} from "@/domains/trainerprogram/types";
import type { Exercise } from "@/domains/exerciselibrary/types";

/** Every mutation here relies on RLS (migration 0075's owner_all
 * policies, each walking the FK chain back to trainer_programs.trainer_id
 * = auth.uid()) to reject writes to another trainer's program -- the
 * regular session-scoped client is used throughout (never the
 * service-role client), so a mismatched id simply matches zero rows
 * rather than needing a manual ownership check in every function here.
 * requireTrainer() itself only establishes "this caller is *a* trainer",
 * not "this caller owns this specific program" -- RLS is what enforces
 * the latter. */

function toProgram(row: Database["public"]["Tables"]["trainer_programs"]["Row"]): TrainerProgram {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    description: row.description,
    status: row.status as TrainerProgram["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPhase(row: Database["public"]["Tables"]["trainer_program_phases"]["Row"]): TrainerProgramPhase {
  return {
    id: row.id,
    programId: row.program_id,
    phaseOrder: row.phase_order,
    name: row.name,
    focus: row.focus,
    lengthWeeks: row.length_weeks,
    isFinal: row.is_final,
  };
}

function toSession(row: Database["public"]["Tables"]["trainer_program_sessions"]["Row"]): TrainerProgramSession {
  return {
    id: row.id,
    phaseId: row.phase_id,
    dayOfWeek: row.day_of_week,
    name: row.name,
    sessionType: row.session_type,
  };
}

function toSessionExercise(
  row: Database["public"]["Tables"]["trainer_program_session_exercises"]["Row"]
): TrainerProgramSessionExercise {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseOrder: row.exercise_order,
    exerciseId: row.exercise_id,
    sets: row.sets,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    intensityType: row.intensity_type as TrainerProgramSessionExercise["intensityType"],
    intensityValue: row.intensity_value,
    durationMinutes: row.duration_minutes,
    cardioIntensity: row.cardio_intensity,
    coachingNotes: row.coaching_notes,
  };
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function listMyPrograms(): Promise<TrainerProgramWithPhases[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  const { data: programRows, error } = await supabase
    .from("trainer_programs")
    .select("*")
    .eq("trainer_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load programs: ${error.message}`);

  const programIds = (programRows ?? []).map((p) => p.id);
  const phasesByProgram = new Map<string, TrainerProgramPhase[]>();
  if (programIds.length > 0) {
    const { data: phaseRows, error: phaseError } = await supabase
      .from("trainer_program_phases")
      .select("*")
      .in("program_id", programIds)
      .order("phase_order", { ascending: true });
    if (phaseError) throw new Error(`Failed to load phases: ${phaseError.message}`);
    for (const row of phaseRows ?? []) {
      const list = phasesByProgram.get(row.program_id) ?? [];
      list.push(toPhase(row));
      phasesByProgram.set(row.program_id, list);
    }
  }

  return (programRows ?? []).map((row) => ({
    ...toProgram(row),
    phases: phasesByProgram.get(row.id) ?? [],
  }));
}

export async function getProgramWithPhases(programId: string): Promise<TrainerProgramWithPhases | null> {
  await requireTrainer();
  const supabase = await createClient();

  const { data: programRow, error } = await supabase
    .from("trainer_programs")
    .select("*")
    .eq("id", programId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load program: ${error.message}`);
  if (!programRow) return null;

  const { data: phaseRows, error: phaseError } = await supabase
    .from("trainer_program_phases")
    .select("*")
    .eq("program_id", programId)
    .order("phase_order", { ascending: true });
  if (phaseError) throw new Error(`Failed to load phases: ${phaseError.message}`);

  return { ...toProgram(programRow), phases: (phaseRows ?? []).map(toPhase) };
}

export async function createProgram(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireTrainer();
  const parsed = trainerProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_programs")
    .insert({ trainer_id: user.id, name: parsed.data.name, description: parsed.data.description || null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_program_created",
    targetType: "trainer_program",
    targetId: data.id,
    detail: { name: parsed.data.name },
  });

  return { ok: true, data: { id: data.id } };
}

export async function updateProgram(programId: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerProgramSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_programs")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", programId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** No delete function -- same retirement-via-status pattern as recipes/
 * exercises: 'archived' takes a program out of the assignable list
 * without orphaning any assignment or materialized workout_plan_items
 * that already reference it. */
/** Leaving 'published' (to 'draft' or 'archived') is refused while any
 * client has an active assignment on this program -- found in code
 * review, 2026-08-06: assignProgramToClient's own published-only guard
 * only applies at assignment time, and neither the weekly cron nor
 * generateAndSaveFromTrainerProgram ever re-check program status, so a
 * program a trainer reopens for editing and moves back to 'draft' mid-
 * assignment would keep silently materializing into a client's live
 * plan regardless -- exactly the "not ready yet" signal 'draft' is
 * supposed to prevent. */
export async function setProgramStatus(
  programId: string,
  status: "draft" | "published" | "archived"
): Promise<ActionResult> {
  const { user } = await requireTrainer();
  const supabase = await createClient();

  if (status !== "published") {
    const { count } = await supabase
      .from("trainer_program_assignments")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("status", "active");
    if (count && count > 0) {
      return {
        ok: false,
        error: "A client is actively assigned to this program -- reassign or end that first.",
      };
    }
  }

  const { error } = await supabase.from("trainer_programs").update({ status }).eq("id", programId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_program_status_changed",
    targetType: "trainer_program",
    targetId: programId,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export async function addPhase(programId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireTrainer();
  const parsed = trainerProgramPhaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: lastPhase } = await supabase
    .from("trainer_program_phases")
    .select("phase_order")
    .eq("program_id", programId)
    .order("phase_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const phaseOrder = (lastPhase?.phase_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("trainer_program_phases")
    .insert({
      program_id: programId,
      phase_order: phaseOrder,
      name: parsed.data.name,
      focus: parsed.data.focus || null,
      length_weeks: parsed.data.lengthWeeks,
      is_final: parsed.data.isFinal,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function updatePhase(phaseId: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerProgramPhaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_program_phases")
    .update({
      name: parsed.data.name,
      focus: parsed.data.focus || null,
      length_weeks: parsed.data.lengthWeeks,
      is_final: parsed.data.isFinal,
    })
    .eq("id", phaseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Whether any already-materialized workout_plan_items still point at
 * one of these trainer_program_session_exercises ids -- the shared check
 * behind deletePhase/deleteSession/deleteSessionExercise below. None of
 * the FKs from workout_plan_items back to this content have an
 * ON DELETE clause (defaults to RESTRICT), so an unguarded delete would
 * fail at the database anyway; checking first turns that into a
 * readable error instead of a raw constraint-violation message. */
async function hasMaterializedReferences(
  sessionExerciseIds: string[],
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  if (sessionExerciseIds.length === 0) return false;
  const { count } = await supabase
    .from("workout_plan_items")
    .select("id", { count: "exact", head: true })
    .in("trainer_program_session_exercise_id", sessionExerciseIds);
  return (count ?? 0) > 0;
}

/** Found in code review (2026-08-06): the original version of this guard
 * checked workout_plans.trainer_program_phase_id, but a materialized
 * week is tagged with only *one* phase (whichever applies to "today")
 * even when its actual day-of-week items straddle a phase boundary --
 * which happens whenever a program's starts_on isn't Sunday-aligned,
 * since phase lengths advance in exact 7-day increments from starts_on,
 * not from the nearest Sunday. That let the guard pass while
 * workout_plan_items still referenced the phase being deleted, via
 * items sourced from a differently-labeled straddling week. This walks
 * the real reference chain (phase -> sessions -> session_exercises ->
 * items) instead of trusting the plan-level label. */
export async function deletePhase(phaseId: string): Promise<ActionResult> {
  await requireTrainer();
  const supabase = await createClient();

  const { data: sessionRows } = await supabase.from("trainer_program_sessions").select("id").eq("phase_id", phaseId);
  const sessionIds = (sessionRows ?? []).map((s) => s.id);

  let sessionExerciseIds: string[] = [];
  if (sessionIds.length > 0) {
    const { data: exerciseRows } = await supabase
      .from("trainer_program_session_exercises")
      .select("id")
      .in("session_id", sessionIds);
    sessionExerciseIds = (exerciseRows ?? []).map((e) => e.id);
  }

  if (await hasMaterializedReferences(sessionExerciseIds, supabase)) {
    return {
      ok: false,
      error: "A client already has a generated plan using content from this phase -- delete won't proceed.",
    };
  }

  const { error } = await supabase.from("trainer_program_phases").delete().eq("id", phaseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function addSession(phaseId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireTrainer();
  const parsed = trainerProgramSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_program_sessions")
    .insert({
      phase_id: phaseId,
      day_of_week: parsed.data.dayOfWeek,
      name: parsed.data.name || null,
      session_type: parsed.data.sessionType || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This phase already has a session on that day." };
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { id: data.id } };
}

export async function updateSession(sessionId: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerProgramSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_program_sessions")
    .update({
      day_of_week: parsed.data.dayOfWeek,
      name: parsed.data.name || null,
      session_type: parsed.data.sessionType || null,
    })
    .eq("id", sessionId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This phase already has a session on that day." };
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Same materialized-reference guard as deletePhase -- found missing
 * entirely here in code review, 2026-08-06 (only deletePhase had one,
 * and even that checked the wrong column). Without it, deleting a
 * session a client already has a generated week from surfaces a raw
 * Postgres FK-violation instead of a readable error. */
export async function deleteSession(sessionId: string): Promise<ActionResult> {
  await requireTrainer();
  const supabase = await createClient();

  const { data: exerciseRows } = await supabase
    .from("trainer_program_session_exercises")
    .select("id")
    .eq("session_id", sessionId);
  const sessionExerciseIds = (exerciseRows ?? []).map((e) => e.id);

  if (await hasMaterializedReferences(sessionExerciseIds, supabase)) {
    return {
      ok: false,
      error: "A client already has a generated plan using this session -- delete won't proceed.",
    };
  }

  const { error } = await supabase.from("trainer_program_sessions").delete().eq("id", sessionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Session exercises
// ---------------------------------------------------------------------------

export async function addSessionExercise(
  sessionId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireTrainer();
  const parsed = trainerProgramSessionExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: lastExercise } = await supabase
    .from("trainer_program_session_exercises")
    .select("exercise_order")
    .eq("session_id", sessionId)
    .order("exercise_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const exerciseOrder = (lastExercise?.exercise_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("trainer_program_session_exercises")
    .insert({
      session_id: sessionId,
      exercise_order: exerciseOrder,
      exercise_id: parsed.data.exerciseId,
      sets: parsed.data.sets ?? null,
      reps_min: parsed.data.repsMin ?? null,
      reps_max: parsed.data.repsMax ?? null,
      intensity_type: parsed.data.intensityType ?? null,
      intensity_value: parsed.data.intensityValue || null,
      duration_minutes: parsed.data.durationMinutes ?? null,
      cardio_intensity: parsed.data.cardioIntensity || null,
      coaching_notes: parsed.data.coachingNotes || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function updateSessionExercise(id: string, input: unknown): Promise<ActionResult> {
  await requireTrainer();
  const parsed = trainerProgramSessionExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trainer_program_session_exercises")
    .update({
      exercise_id: parsed.data.exerciseId,
      sets: parsed.data.sets ?? null,
      reps_min: parsed.data.repsMin ?? null,
      reps_max: parsed.data.repsMax ?? null,
      intensity_type: parsed.data.intensityType ?? null,
      intensity_value: parsed.data.intensityValue || null,
      duration_minutes: parsed.data.durationMinutes ?? null,
      cardio_intensity: parsed.data.cardioIntensity || null,
      coaching_notes: parsed.data.coachingNotes || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Same materialized-reference guard as deletePhase/deleteSession --
 * found missing entirely here in code review, 2026-08-06. */
export async function deleteSessionExercise(id: string): Promise<ActionResult> {
  await requireTrainer();
  const supabase = await createClient();

  if (await hasMaterializedReferences([id], supabase)) {
    return {
      ok: false,
      error: "A client already has a generated plan using this exercise -- delete won't proceed.",
    };
  }

  const { error } = await supabase.from("trainer_program_session_exercises").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Hydration -- for the builder UI and for materialization (domains/trainer/
// service.ts's generateFromTrainerProgram)
// ---------------------------------------------------------------------------

export async function getFirstPhase(
  programId: string,
  client?: SupabaseClient<Database>
): Promise<TrainerProgramPhase | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("trainer_program_phases")
    .select("*")
    .eq("program_id", programId)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load first phase: ${error.message}`);
  return data ? toPhase(data) : null;
}

export async function getPhaseById(
  phaseId: string,
  client?: SupabaseClient<Database>
): Promise<TrainerProgramPhase | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("trainer_program_phases").select("*").eq("id", phaseId).maybeSingle();
  if (error) throw new Error(`Failed to load phase: ${error.message}`);
  return data ? toPhase(data) : null;
}

export async function getNextPhase(
  currentPhase: TrainerProgramPhase,
  client?: SupabaseClient<Database>
): Promise<TrainerProgramPhase | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("trainer_program_phases")
    .select("*")
    .eq("program_id", currentPhase.programId)
    .gt("phase_order", currentPhase.phaseOrder)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load next phase: ${error.message}`);
  return data ? toPhase(data) : null;
}

export async function getPhaseHydrated(
  phaseId: string,
  client?: SupabaseClient<Database>
): Promise<HydratedTrainerProgramPhase | null> {
  const supabase = client ?? (await createClient());

  const { data: phaseRow, error: phaseError } = await supabase
    .from("trainer_program_phases")
    .select("*")
    .eq("id", phaseId)
    .maybeSingle();
  if (phaseError) throw new Error(`Failed to load phase: ${phaseError.message}`);
  if (!phaseRow) return null;

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("trainer_program_sessions")
    .select("*")
    .eq("phase_id", phaseId)
    .order("day_of_week", { ascending: true });
  if (sessionsError) throw new Error(`Failed to load sessions: ${sessionsError.message}`);

  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const exercisesBySession = new Map<string, TrainerProgramSessionExercise[]>();
  if (sessionIds.length > 0) {
    const { data: exerciseRows, error: exercisesError } = await supabase
      .from("trainer_program_session_exercises")
      .select("*")
      .in("session_id", sessionIds)
      .order("exercise_order", { ascending: true });
    if (exercisesError) throw new Error(`Failed to load session exercises: ${exercisesError.message}`);
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

/** Every phase of a program, fully hydrated, sorted by phase_order --
 * what calendar-projection.ts needs (it walks phases in order to resolve
 * which one a given date falls into). Three batched queries regardless
 * of phase count, not N calls to getPhaseHydrated -- this runs on every
 * weekly generation and every calendar month load. */
export async function getHydratedPhasesForProgram(
  programId: string,
  client?: SupabaseClient<Database>
): Promise<HydratedTrainerProgramPhase[]> {
  const supabase = client ?? (await createClient());

  const { data: phaseRows, error: phaseError } = await supabase
    .from("trainer_program_phases")
    .select("*")
    .eq("program_id", programId)
    .order("phase_order", { ascending: true });
  if (phaseError) throw new Error(`Failed to load phases: ${phaseError.message}`);
  if (!phaseRows || phaseRows.length === 0) return [];

  const phaseIds = phaseRows.map((p) => p.id);
  const { data: sessionRows, error: sessionsError } = await supabase
    .from("trainer_program_sessions")
    .select("*")
    .in("phase_id", phaseIds)
    .order("day_of_week", { ascending: true });
  if (sessionsError) throw new Error(`Failed to load sessions: ${sessionsError.message}`);

  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const exercisesBySession = new Map<string, TrainerProgramSessionExercise[]>();
  if (sessionIds.length > 0) {
    const { data: exerciseRows, error: exercisesError } = await supabase
      .from("trainer_program_session_exercises")
      .select("*")
      .in("session_id", sessionIds)
      .order("exercise_order", { ascending: true });
    if (exercisesError) throw new Error(`Failed to load session exercises: ${exercisesError.message}`);
    for (const row of exerciseRows ?? []) {
      const list = exercisesBySession.get(row.session_id) ?? [];
      list.push(toSessionExercise(row));
      exercisesBySession.set(row.session_id, list);
    }
  }

  const sessionsByPhase = new Map<string, HydratedTrainerProgramPhase["sessions"]>();
  for (const row of sessionRows ?? []) {
    const list = sessionsByPhase.get(row.phase_id) ?? [];
    list.push({ ...toSession(row), exercises: exercisesBySession.get(row.id) ?? [] });
    sessionsByPhase.set(row.phase_id, list);
  }

  return phaseRows.map((row) => ({
    ...toPhase(row),
    sessions: sessionsByPhase.get(row.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Trainer-submitted exercises
// ---------------------------------------------------------------------------

function toExercise(row: Database["public"]["Tables"]["exercises"]["Row"]): Exercise {
  return {
    id: row.id,
    name: row.name,
    movementPattern: row.movement_pattern,
    equipmentRequired: row.equipment_required,
    archetypeTags: row.archetype_tags,
    difficulty: row.difficulty as Exercise["difficulty"],
    primaryMuscleGroups: row.primary_muscle_groups,
    instructions: row.instructions,
  };
}

/** Active library exercises plus this trainer's own not-yet-reviewed
 * submissions -- so a trainer can immediately use an exercise they just
 * added without waiting on admin review, while every other trainer/
 * client still only ever sees 'active' ones (getAllExercises). */
export async function getExercisesForTrainer(): Promise<Exercise[]> {
  const { user } = await requireTrainer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .or(`status.eq.active,created_by.eq.${user.id}`);
  if (error) throw new Error(`Failed to load exercises: ${error.message}`);
  return (data ?? []).map(toExercise);
}

export async function createExerciseAsTrainer(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireTrainer();
  const parsed = trainerExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: parsed.data.name,
      canonical_name: parsed.data.name,
      movement_pattern: parsed.data.movementPattern,
      movement_patterns: [parsed.data.movementPattern],
      difficulty: parsed.data.difficulty,
      equipment_required: parsed.data.equipmentRequired,
      primary_muscle_groups: parsed.data.primaryMuscleGroups,
      archetype_tags: parsed.data.archetypeTags,
      instructions: parsed.data.instructions || null,
      status: "review",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "trainer_exercise_submitted",
    targetType: "exercise",
    targetId: data.id,
    detail: { name: parsed.data.name },
  });

  return { ok: true, data: { id: data.id } };
}
