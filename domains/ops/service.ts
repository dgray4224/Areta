"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { AiRun } from "@/domains/ops/types";

export type AiRunFilter = "all" | "success" | "failure";

/** Owner-only (RLS: ai_runs_admin_select, migration 0062, keyed off
 * is_admin_owner()) — a reviewer session gets an empty result set here,
 * not an error, same as any other RLS-filtered query. requireAdminOwner()
 * in the page itself is what actually keeps reviewers off this route. */
export async function listAiRunsAdmin(
  filter: AiRunFilter = "all",
  limit = 50,
  client?: SupabaseClient<Database>
): Promise<AiRun[]> {
  const supabase = client ?? (await createClient());
  let query = supabase.from("ai_runs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filter === "success") query = query.eq("success", true);
  if (filter === "failure") query = query.eq("success", false);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load AI runs: ${error.message}`);

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const nameByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) nameByUserId.set(p.id, p.full_name);
  }

  return rows.map(
    (row): AiRun => ({
      id: row.id,
      userId: row.user_id,
      userName: nameByUserId.get(row.user_id) ?? null,
      purpose: row.purpose,
      model: row.model,
      success: row.success,
      error: row.error,
      createdAt: row.created_at,
    })
  );
}

export async function countAiRunFailures(
  sinceDays: number,
  client?: SupabaseClient<Database>
): Promise<number> {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("created_at", since);
  return count ?? 0;
}

/** Live proxy for cron health rather than real run history — no
 * cron_runs log table exists (the weekly regenerate-workout-plans cron
 * doesn't persist anything about its own runs, see
 * app/api/cron/regenerate-workout-plans/route.ts). This counts active
 * workout plans whose week_start has already fallen behind the current
 * week — exactly the set that cron's own query targets — so a growing
 * number here means the cron either hasn't run recently or is failing,
 * even without a historical log to point at directly. */
export async function countStaleWorkoutPlans(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient());
  const weekStart = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("workout_plans")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .lt("week_start", weekStart);
  return count ?? 0;
}
