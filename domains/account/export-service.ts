"use server";

import { createClient } from "@/platform/supabase/server";

/**
 * Data export (CLAUDE.md First-Week MVP requirement). Assembles the
 * user's own rows across every table RLS scopes to them into one JSON
 * object — no cross-user data, no service-role access needed since this
 * runs with the caller's own session.
 */
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
  const results = await Promise.all(
    tables.map((table) =>
      supabase
        .from(table)
        .select("*")
        .eq(idColumn(table) as "id", userId)
    )
  );

  const exportData: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
  };

  tables.forEach((table, i) => {
    const { data, error } = results[i];
    exportData[table] = error ? { error: error.message } : (data ?? []);
  });

  // weight_logs/sleep_logs used to be their own tables, now they're
  // metric_type-filtered slices of health_metrics — kept as two separate
  // export keys (same names as before the migration) rather than adding a
  // third generic "health_metrics" key, so an existing export's shape
  // doesn't change. steps/heart_rate/workout/vitals were never included in
  // this export before the migration and stay excluded now (scope
  // unchanged, not expanded as a side effect of this refactor).
  const [{ data: weightRows, error: weightError }, { data: sleepRows, error: sleepError }] = await Promise.all([
    supabase.from("health_metrics").select("*").eq("user_id", userId).eq("metric_type", "weight"),
    supabase.from("health_metrics").select("*").eq("user_id", userId).eq("metric_type", "sleep"),
  ]);
  exportData.weight_logs = weightError ? { error: weightError.message } : (weightRows ?? []);
  exportData.sleep_logs = sleepError ? { error: sleepError.message } : (sleepRows ?? []);

  return exportData;
}
