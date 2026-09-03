"use server";

import { createClient } from "@/platform/supabase/server";

/**
 * Data export (CLAUDE.md First-Week MVP requirement). Assembles the
 * user's own rows across every table RLS scopes to them into one JSON
 * object — no cross-user data, no service-role access needed since this
 * runs with the caller's own session.
 */

// PostgREST silently caps any response at 1,000 rows. An export must be
// complete by definition, so every table is paged; a heavy account's
// action_events or imported health_metrics run well past one page.
const PAGE_SIZE = 1000;

type PagedResult = { data: unknown[] } | { error: { message: string } };

async function fetchAllRows(
  buildPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<PagedResult> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) return { error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows };
  }
}

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const supabase = await createClient();

  // calendar_connections is deliberately excluded — it holds encrypted
  // OAuth tokens/app-specific passwords, and exporting them (even encrypted)
  // serves no user need while needlessly widening this feature's blast radius.
  const tables = [
    "profiles",
    "domains",
    "goals",
    "phases",
    "weekly_outcomes",
    "personalization_profiles",
    "onboarding_responses",
    "nutrition_logs",
    "recovery_logs",
    "study_sessions",
    "daily_actions",
    "action_events",
    "generated_parameters",
    "meal_plans",
    "meal_plan_items",
    "grocery_lists",
    "grocery_items",
    "inventory_items",
    "prep_plans",
    "prep_steps",
    "weekly_reviews",
    "recommendations",
  ] as const;

  const idColumn = (table: (typeof tables)[number]) => (table === "profiles" ? "id" : "user_id");

  // Supabase's generated types can't verify a per-iteration dynamic table
  // name against a matching dynamic column name (each table's Row type
  // has a different key set) — same class of limitation as the computed
  // upsert key in domains/onboarding/store.ts. Cast at this one boundary.
  // Paging needs a stable order; every table here has an "id" primary key.
  const results = await Promise.all(
    tables.map((table) =>
      fetchAllRows((from, to) =>
        supabase
          .from(table)
          .select("*")
          .eq(idColumn(table) as "id", userId)
          .order("id", { ascending: true })
          .range(from, to)
      )
    )
  );

  const exportData: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
  };

  tables.forEach((table, i) => {
    const result = results[i];
    exportData[table] = "error" in result ? { error: result.error.message } : result.data;
  });

  // weight_logs/sleep_logs used to be their own tables, now they're
  // metric_type-filtered slices of health_metrics — kept as two separate
  // export keys (same names as before the migration) rather than adding a
  // third generic "health_metrics" key, so an existing export's shape
  // doesn't change. steps/heart_rate/workout/vitals were never included in
  // this export before the migration and stay excluded now (scope
  // unchanged, not expanded as a side effect of this refactor).
  const [weightResult, sleepResult] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("health_metrics")
        .select("*")
        .eq("user_id", userId)
        .eq("metric_type", "weight")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("health_metrics")
        .select("*")
        .eq("user_id", userId)
        .eq("metric_type", "sleep")
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  exportData.weight_logs = "error" in weightResult ? { error: weightResult.error.message } : weightResult.data;
  exportData.sleep_logs = "error" in sleepResult ? { error: sleepResult.error.message } : sleepResult.data;

  return exportData;
}
