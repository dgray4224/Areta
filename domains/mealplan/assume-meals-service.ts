import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { createClient } from "@/platform/supabase/server";
import { todayForUser } from "@/domains/activity-summary/service";
import { setMealPlanItemCompleted } from "@/domains/mealplan/service";
import { itemsToAssumeEaten, type AssumableItem } from "@/domains/mealplan/assume-meals";

/**
 * Marks a planned meal as explicitly not eaten. The counterpart to
 * confirming one, and the thing that makes assuming safe: silence now
 * means the plan happened, so a person needs a way to say it didn't
 * that the next nightly pass will respect.
 *
 * Clears any completion, because "I didn't eat this" is also the undo
 * for a meal that was assumed or ticked by mistake — including the
 * nutrition_logs row written at the time, which would otherwise leave
 * calories behind for food the person just told us they never ate.
 */
export async function setMealPlanItemSkipped(
  userId: string,
  itemId: string,
  skipped: boolean,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  if (!skipped) {
    const { error } = await supabase
      .from("meal_plan_items")
      .update({ skipped_at: null })
      .eq("id", itemId)
      .eq("user_id", userId);
    return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
  }

  // Reuse the un-complete path so the log row and its macros go with it.
  const cleared = await setMealPlanItemCompleted(userId, itemId, false, supabase);
  if (!cleared.ok) return cleared;

  const { error } = await supabase
    .from("meal_plan_items")
    .update({ skipped_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

/**
 * Fills in the meals nobody answered about on days that are over, for
 * one user. Idempotent: an item already completed or skipped is never
 * touched, so running twice in a night changes nothing.
 *
 * Writes through setMealPlanItemCompleted so an assumed meal gets the
 * same real nutrition_logs row a tapped one does, stamped `assumed`.
 * That is deliberate — adherence and calorie totals only mean something
 * if the intake is actually recorded — and it is exactly why the stamp
 * and the skip action exist.
 */
export async function assumePlannedMealsForUser(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<{ assumed: number }> {
  try {
    const supabase = client ?? (await createClient());
    const today = await todayForUser(supabase, userId);

    const { data: plans, error } = await supabase
      .from("meal_plans")
      .select("week_start, meal_plan_items(id, day_of_week, completed_at, skipped_at, created_at)")
      .eq("user_id", userId)
      .eq("status", "active");
    if (error || !plans) return { assumed: 0 };

    const items: AssumableItem[] = [];
    for (const plan of plans) {
      for (const item of plan.meal_plan_items ?? []) {
        items.push({
          id: item.id,
          date: addDays(plan.week_start, item.day_of_week),
          completedAt: item.completed_at,
          skippedAt: item.skipped_at,
          createdAt: item.created_at,
        });
      }
    }

    const ids = itemsToAssumeEaten({ items, today });
    let assumed = 0;
    for (const id of ids) {
      // One at a time: each write also creates a nutrition_logs row and
      // links it, which the bulk path cannot express.
      const result = await setMealPlanItemCompleted(userId, id, true, supabase, "assumed");
      if (result.ok) assumed += 1;
    }
    return { assumed };
  } catch {
    return { assumed: 0 };
  }
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
