"use server";

import { goalsStepSchema } from "@/domains/goals/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export type GoalView = { id: string; outcome: string; targetDate: string | null; priority: number | null };

/** Active goals ordered by priority (1 = highest), matching
 * areta-mobile's lib/queries/goals.ts#getActiveGoals exactly — goals
 * with no priority set sort last rather than first (nullsFirst: false),
 * since an unranked goal shouldn't outrank an explicitly prioritized
 * one, and abandoned/completed goals are excluded via status='active'.
 * Dashboard's and Plan's own "top 3" slices predate this (they select
 * without a status filter and without nullsFirst) — this is the more
 * correct version, worth pointing new callers at. */
export async function getActiveGoals(userId: string, client?: SupabaseClient<Database>): Promise<GoalView[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("goals")
    .select("id, outcome, target_date, priority")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("priority", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load goals: ${error.message}`);
  }
  return (data ?? []).map((g) => ({ id: g.id, outcome: g.outcome, targetDate: g.target_date, priority: g.priority }));
}

export async function saveGoalsStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = goalsStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "goals", parsed.data.goals, client);
  return { ok: true, data: undefined };
}
