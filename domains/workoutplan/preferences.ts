import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";

// Same reasoning and window as domains/mealplan/preferences.ts's
// PICK_HISTORY_LOOKBACK_WEEKS -- bounded so tastes can drift rather than
// one early obsession permanently dominating.
const PICK_HISTORY_LOOKBACK_WEEKS = 12;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * exerciseId -> how many days the user has explicitly assigned it to via
 * the "Customize this week" flow (domains/workoutplan/customize.ts) in
 * the last PICK_HISTORY_LOOKBACK_WEEKS weeks. Feeds generateWorkoutPlan's
 * pickWeights (the legacy/goal-first generation path's only per-exercise
 * choice point -- program-based plans' real lever is explicit session
 * assignment via Phase C, not generation-time bias). Kept as a separate
 * DB read here, not inlined into generate.ts, so that function stays
 * pure/testable with no DB dependency.
 */
export async function getExercisePickFrequency(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<Map<string, number>> {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - PICK_HISTORY_LOOKBACK_WEEKS * MS_PER_WEEK).toISOString();

  const { data: rows, error } = await supabase
    .from("exercise_pick_history")
    .select("exercise_id")
    .eq("user_id", userId)
    .gte("picked_at", since);

  if (error || !rows) return new Map();

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.exercise_id, (counts.get(row.exercise_id) ?? 0) + 1);
  }
  return counts;
}
