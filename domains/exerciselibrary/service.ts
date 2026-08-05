"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { exerciseAdminSchema } from "@/domains/exerciselibrary/schema";
import type {
  Exercise,
  AdminExercise,
  ExerciseStatus,
} from "@/domains/exerciselibrary/types";

export async function getAllExercises(client?: SupabaseClient<Database>): Promise<Exercise[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("exercises").select("*");

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  return (data ?? []).map(
    (row): Exercise => ({
      id: row.id,
      name: row.name,
      movementPattern: row.movement_pattern,
      equipmentRequired: row.equipment_required,
      archetypeTags: row.archetype_tags,
      difficulty: row.difficulty as Exercise["difficulty"],
      primaryMuscleGroups: row.primary_muscle_groups,
      instructions: row.instructions,
    })
  );
}

export async function getExercisesByIds(
  ids: string[],
  client?: SupabaseClient<Database>
): Promise<Map<string, Exercise>> {
  if (ids.length === 0) return new Map();
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("exercises").select("*").in("id", ids);

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  const map = new Map<string, Exercise>();
  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      movementPattern: row.movement_pattern,
      equipmentRequired: row.equipment_required,
      archetypeTags: row.archetype_tags,
      difficulty: row.difficulty as Exercise["difficulty"],
      primaryMuscleGroups: row.primary_muscle_groups,
      instructions: row.instructions,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Admin content management (Phase C) — full row shape, all statuses
// ---------------------------------------------------------------------------

function toAdminExercise(row: Database["public"]["Tables"]["exercises"]["Row"]): AdminExercise {
  return {
    id: row.id,
    name: row.name,
    movementPattern: row.movement_pattern,
    equipmentRequired: row.equipment_required,
    archetypeTags: row.archetype_tags,
    difficulty: row.difficulty as Exercise["difficulty"],
    primaryMuscleGroups: row.primary_muscle_groups,
    instructions: row.instructions,
    canonicalName: row.canonical_name,
    aliases: row.aliases,
    movementPatterns: row.movement_patterns,
    secondaryMuscleGroups: row.secondary_muscle_groups,
    modality: row.modality as AdminExercise["modality"],
    unilateral: row.unilateral,
    compound: row.compound,
    setupRequirements: row.setup_requirements,
    limitationTags: row.limitation_tags,
    contraindicationNotes: row.contraindication_notes,
    status: row.status as ExerciseStatus,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    createdAt: row.created_at,
  };
}

export async function countExercisesByStatus(
  status: ExerciseStatus,
  client?: SupabaseClient<Database>
): Promise<number> {
  const supabase = client ?? (await createClient());
  const { count } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

export async function listExercisesAdmin(
  status?: ExerciseStatus,
  client?: SupabaseClient<Database>
): Promise<AdminExercise[]> {
  const supabase = client ?? (await createClient());
  let query = supabase.from("exercises").select("*").order("name", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load exercises: ${error.message}`);
  return (data ?? []).map(toAdminExercise);
}

export async function getExerciseAdmin(
  id: string,
  client?: SupabaseClient<Database>
): Promise<AdminExercise | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load exercise: ${error.message}`);
  return data ? toAdminExercise(data) : null;
}

function toInsertRow(parsed: ReturnType<typeof exerciseAdminSchema.parse>) {
  return {
    name: parsed.name,
    canonical_name: parsed.canonicalName,
    movement_pattern: parsed.movementPattern,
    movement_patterns: [parsed.movementPattern],
    difficulty: parsed.difficulty,
    equipment_required: parsed.equipmentRequired,
    primary_muscle_groups: parsed.primaryMuscleGroups,
    secondary_muscle_groups: parsed.secondaryMuscleGroups,
    archetype_tags: parsed.archetypeTags,
    aliases: parsed.aliases,
    setup_requirements: parsed.setupRequirements,
    limitation_tags: parsed.limitationTags,
    modality: parsed.modality || null,
    unilateral: parsed.unilateral,
    compound: parsed.compound,
    contraindication_notes: parsed.contraindicationNotes || null,
    instructions: parsed.instructions || null,
    image_url: parsed.imageUrl || null,
    video_url: parsed.videoUrl || null,
    status: parsed.status,
  };
}

export async function createExerciseAdmin(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert(toInsertRow(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function updateExerciseAdmin(id: string, input: unknown): Promise<ActionResult> {
  const parsed = exerciseAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").update(toInsertRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Exercises have no reviewed_by/reviewed_at columns (unlike the Phase B
 * registry tables) — status is just set directly, no review-provenance
 * trail. Deliberately no delete function: `status: 'deprecated'` is this
 * table's own retirement mechanism, and a hard delete risks orphaning
 * whatever else references the row (workout_plan_items, expert_claims,
 * limitation_rules, program_session_exercises, etc.). */
export async function setExerciseStatus(id: string, status: ExerciseStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
