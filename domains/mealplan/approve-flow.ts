"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { approveMealPlan, generateAndSaveMealPlan } from "@/domains/mealplan/service";
import { generateAndSaveGroceryList } from "@/domains/grocery/service";
import { generateAndSavePrepPlan } from "@/domains/prep/service";
import type { RecipeCuisine } from "@/domains/recipes/types";
import { addDays } from "@/platform/ui/week-dates";

function currentWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Approving a meal plan (CLAUDE.md rule 10: require approval before a
 * generated plan becomes active) cascades into the grocery list and Sunday
 * prep plan, since both are derived directly from the approved plan. */
export async function approveMealPlanAndGenerateDownstream(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const approveResult = await approveMealPlan(userId, client);
  if (!approveResult.ok) return approveResult;

  const groceryResult = await generateAndSaveGroceryList(userId, client);
  if (!groceryResult.ok) return groceryResult;

  const prepResult = await generateAndSavePrepPlan(userId, client);
  if (!prepResult.ok) return prepResult;

  return { ok: true, data: undefined };
}

/**
 * Generates and auto-approves `weeks` consecutive meal plans starting from
 * `weekStart` (defaults to the current week), one after another. Each week
 * is approved (and cascades to grocery/prep, see
 * approveMealPlanAndGenerateDownstream) before the next week is generated
 * -- CLAUDE.md rule 10 is still satisfied per-week, this just runs the
 * generate+approve cycle `weeks` times in a row instead of requiring the
 * caller to drive it, mirroring what generatePlansAfterOnboarding already
 * does for a single week.
 */
export async function generateAndSaveMealPlanWeeks(
  userId: string,
  options: { weeks: number; weekStart?: string; extraExcludeKeywords?: string[]; preferredCuisines?: RecipeCuisine[] },
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const startWeek = options.weekStart ?? currentWeekStart();
  const warnings: string[] = [];

  for (let i = 0; i < options.weeks; i++) {
    const weekStart = i === 0 ? startWeek : addDays(startWeek, i * 7);

    const generateResult = await generateAndSaveMealPlan(
      userId,
      { weekStart, extraExcludeKeywords: options.extraExcludeKeywords, preferredCuisines: options.preferredCuisines },
      supabase
    );
    if (!generateResult.ok) return generateResult;
    warnings.push(...generateResult.data.warnings);

    const approveResult = await approveMealPlanAndGenerateDownstream(userId, supabase);
    if (!approveResult.ok) return approveResult;
  }

  return { ok: true, data: { warnings } };
}
