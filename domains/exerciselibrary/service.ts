"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { createAdminClient } from "@/platform/supabase/admin";
import { requireAdmin } from "@/platform/auth/admin";
import { logAdminAction } from "@/platform/audit/log";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { exerciseAdminSchema } from "@/domains/exerciselibrary/schema";
import type {
  Exercise,
  AdminExercise,
  ExerciseStatus,
} from "@/domains/exerciselibrary/types";

/** Only `status: 'active'` exercises — this feeds real workout-plan
 * generation (domains/workoutplan/service.ts) and the mobile library
 * endpoint, so an admin-authored exercise still sitting in "review"
 * never reaches a real user. (Fixed alongside the recipes work below —
 * this filter was missing when the exercise admin editor first shipped,
 * so its "review" default status wasn't actually enforced anywhere yet.)
 * Also used to populate the exercise picker on the claims/limitation-rule
 * admin forms, which as a side effect means those can only cite
 * already-active exercises — reasonable, since a claim about an exercise
 * still being vetted isn't very actionable yet either. */
export async function getAllExercises(client?: SupabaseClient<Database>): Promise<Exercise[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("exercises").select("*").eq("status", "active");

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
      movementPatterns: row.movement_patterns,
      modality: row.modality as Exercise["modality"],
      limitationTags: row.limitation_tags,
      compound: row.compound,
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
      movementPatterns: row.movement_patterns,
      modality: row.modality as Exercise["modality"],
      limitationTags: row.limitation_tags,
      compound: row.compound,
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
    createdBy: row.created_by,
  };
}

/** Resolves created_by ids to display names for the admin content review
 * queue — goes through the service-role client rather than
 * get_visible_profile_names, since that RPC is gated by trainer/client/
 * marketplace relationships (migration 0072) and has no admin bypass; an
 * admin reviewing a random trainer's submission isn't in any of those
 * relationships with them. */
export async function getExerciseSubmitterNames(ids: string[]): Promise<Map<string, string | null>> {
  await requireAdmin();
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name").in("id", uniqueIds);
  return new Map((data ?? []).map((row) => [row.id, row.full_name]));
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
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "exercise_status_changed",
    targetType: "exercise",
    targetId: id,
    detail: { status },
  });

  return { ok: true, data: undefined };
}
