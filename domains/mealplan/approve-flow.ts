"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { approveMealPlan, generateAndSaveMealPlan } from "@/domains/mealplan/service";
import { mealPlanExistsForWeek } from "@/domains/mealplan/customize";
import { generateAndSaveGroceryList } from "@/domains/grocery/service";
import { generateAndSavePrepPlan } from "@/domains/prep/service";
import type { RecipeCuisine } from "@/domains/recipes/types";
import { addDays, weekStartFor } from "@/platform/ui/week-dates";
import { todayForUser } from "@/domains/activity-summary/service";

/** The Sunday starting the current week. Normalized deliberately: this
 * used to return today's raw date, which anchored an entire +7 ladder of
 * generated plans to whatever weekday the generator happened to run on
 * (see weekStartFor's doc comment for the damage that caused). */
function currentWeekStart(): string {
  return weekStartFor(new Date().toISOString().slice(0, 10));
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
  // A caller-supplied weekStart is normalized too -- callers pass "some
  // date in the week they mean", not necessarily a week boundary.
  const startWeek = weekStartFor(options.weekStart ?? currentWeekStart());
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

/**
 * Keeps `weekCount` consecutive weeks (current + `weekCount - 1` more)
 * generated & active for a self-service user, WITHOUT ever touching a week
 * that already has real content -- the non-destructive counterpart to
 * generateAndSaveMealPlanWeeks above, which unconditionally overwrites
 * every week in its range and so is only safe for the old "regenerate N
 * weeks from scratch" bulk button, not a passive rolling-ahead cron that
 * must never clobber a week the user already customized.
 *
 * "Stale" and "missing" collapse into the same case here: checking
 * mealPlanExistsForWeek at each of the `weekCount` exact week-starts
 * naturally catches a stale current-week plan too (its real week_start is
 * some week in the past, which doesn't match today's target slot, so that
 * slot reads as "missing" and gets a fresh plan) -- no separate staleness
 * query needed beyond whatever already decided to call this for a given
 * user (see regenerate-meal-plans/route.ts).
 *
 * activateImmediately: true on every generated week (2026-08-09 self-
 * service auto-activate policy) plus an immediate per-week grocery/prep
 * regen (mirroring approveMealPlanAndGenerateDownstream's cascade, just
 * without the separate approve step) -- so a week this function creates
 * is fully usable (dots, grocery list, prep plan) the moment it's created,
 * not just the meal_plans row.
 */
export async function ensureMealPlanWeeksAhead(
  userId: string,
  weekCount: number,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ generatedWeeks: string[]; warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const startWeek = weekStartFor(await todayForUser(supabase, userId));
  const generatedWeeks: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < weekCount; i++) {
    const weekStart = i === 0 ? startWeek : addDays(startWeek, i * 7);
    if (await mealPlanExistsForWeek(userId, weekStart, supabase)) continue;

    const generateResult = await generateAndSaveMealPlan(userId, { weekStart, activateImmediately: true }, supabase);
    if (!generateResult.ok) return generateResult;
    warnings.push(...generateResult.data.warnings);

    const groceryResult = await generateAndSaveGroceryList(userId, supabase, weekStart);
    if (!groceryResult.ok) return groceryResult;
    const prepResult = await generateAndSavePrepPlan(userId, supabase, weekStart);
    if (!prepResult.ok) return prepResult;

    generatedWeeks.push(weekStart);
  }

  return { ok: true, data: { generatedWeeks, warnings } };
}
