"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { Exercise } from "@/domains/exerciselibrary/types";

export async function getAllExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
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
