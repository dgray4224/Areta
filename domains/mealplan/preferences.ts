import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";

// Bounded lookback rather than all-time counts -- lets tastes drift
// instead of one early obsession permanently dominating every future
// week's generation. Matches the "12 weeks" scale other bounded-history
// reads in this codebase use as a reasonable "recent enough to matter"
// window (e.g. the HealthKit retention-window precedent, though that one
// is years not weeks -- this is a much faster-moving signal by design).
const PICK_HISTORY_LOOKBACK_WEEKS = 12;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * recipeId -> how many (day, meal_type) slots the user has explicitly
 * assigned it to via the "Customize this week" flow
 * (domains/mealplan/customize.ts#assignMealPlanDays) in the last
 * PICK_HISTORY_LOOKBACK_WEEKS weeks. Feeds generateMealPlan's
 * pickWeights as a soft scoring nudge (domains/mealplan/generate.ts) --
 * kept as a separate DB read here, not inlined into generate.ts, so
 * that function stays pure/testable with no DB dependency.
 */
export async function getRecipePickFrequency(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<Map<string, number>> {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - PICK_HISTORY_LOOKBACK_WEEKS * MS_PER_WEEK).toISOString();

  const { data: rows, error } = await supabase
    .from("meal_pick_history")
    .select("recipe_id")
    .eq("user_id", userId)
    .gte("picked_at", since);

  if (error || !rows) return new Map();

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.recipe_id, (counts.get(row.recipe_id) ?? 0) + 1);
  }
  return counts;
}
