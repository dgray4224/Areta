/**
 * One-off repair: collapse duplicate meal/workout plans that cover the
 * same calendar week down to one plan per week.
 *
 * How the duplicates happened: before 2026-08-15 the plan generators used
 * the raw current date as a `week_start` and stepped +7 from it, and the
 * "does this week already exist?" guards matched on the exact date. So a
 * generator run on a Sunday and another on a Wednesday each seeded their
 * own independent ladder, invisible to each other. The grocery list picks
 * exactly one plan per week (`order by week_start desc limit 1`), so it
 * silently reflected only the later ladder and omitted the other plan's
 * meals. The code fix (weekStartFor + window-based existence checks)
 * stops new duplicates; this repairs the rows already written.
 *
 * Keeps the plan anchored to the week's Sunday — the anchor every new
 * plan now uses — and ARCHIVES the rest (status='archived'; nothing is
 * deleted, so this is reversible by flipping the status back).
 *
 * Two hard safety rules:
 *   1. Never archives a plan with any completed or logged item. Real user
 *      activity outranks tidiness; such a week is reported and skipped.
 *   2. Only touches weeks at/after `--from` (defaults to the current
 *      week's Sunday). Past weeks hold logged history and can't affect a
 *      future grocery list, so they're left alone.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/dedupe-plan-weeks.ts <email> [--from YYYY-MM-DD] [--apply]
 * Defaults to a dry run; pass --apply to write.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { weekStartFor } from "@/platform/ui/week-dates";
// domains/grocery/service pulls in platform/env, which validates
// NEXT_PUBLIC_* at import time -- and static imports are hoisted above
// loadEnv() above. Imported dynamically inside main() instead, the same
// way scripts/verify-plan-autoactivate.ts loads its domain modules.

type PlanRow = { id: string; week_start: string; status: string };

function groupByCalendarWeek(rows: PlanRow[]): Map<string, PlanRow[]> {
  const byWeek = new Map<string, PlanRow[]>();
  for (const row of rows) {
    const key = weekStartFor(row.week_start);
    byWeek.set(key, [...(byWeek.get(key) ?? []), row]);
  }
  return byWeek;
}

/** The row to keep: the one already anchored to the week's Sunday, else
 * the earliest anchor in that week (deterministic, and the closest thing
 * to the week's true start). */
function pickKeeper(week: string, rows: PlanRow[]): PlanRow {
  return rows.find((r) => r.week_start === week) ?? [...rows].sort((a, b) => a.week_start.localeCompare(b.week_start))[0];
}

async function main() {
  const email = process.argv[2];
  const apply = process.argv.includes("--apply");
  const fromIdx = process.argv.indexOf("--from");
  if (!email) {
    console.error("Usage: dedupe-plan-weeks.ts <email> [--from YYYY-MM-DD] [--apply]");
    process.exit(1);
  }
  const from = fromIdx !== -1 ? process.argv[fromIdx + 1] : weekStartFor(new Date().toISOString().slice(0, 10));

  const supabase = createScriptAdminClient();
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = userList?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user with email ${email}`);

  console.log(`${apply ? "APPLYING" : "DRY RUN"} for ${email}, weeks from ${from} onward\n`);

  const toArchive: { table: string; id: string; week_start: string }[] = [];
  const keptMealWeeks: string[] = [];

  for (const [table, itemsTable, planFk] of [
    ["meal_plans", "meal_plan_items", "meal_plan_id"],
    ["workout_plans", "workout_plan_items", "workout_plan_id"],
  ] as const) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("id, week_start, status")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .gte("week_start", from)
      .order("week_start", { ascending: true });
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);

    console.log(`--- ${table} ---`);
    for (const [week, plans] of [...groupByCalendarWeek((rows ?? []) as PlanRow[])].sort()) {
      const keeper = pickKeeper(week, plans);
      if (table === "meal_plans") keptMealWeeks.push(keeper.week_start);
      if (plans.length === 1) {
        console.log(`  ${week}  ok (single plan, anchor ${keeper.week_start})`);
        continue;
      }

      // Safety rule 1: never archive a plan the user has actually used.
      const losers = plans.filter((p) => p.id !== keeper.id);
      const { data: usedItems, error: itemsError } = await supabase
        .from(itemsTable)
        .select(`id, ${planFk}`)
        .in(planFk, losers.map((p) => p.id))
        .not("completed_at", "is", null);
      if (itemsError) throw new Error(`${itemsTable} check failed: ${itemsError.message}`);
      if (usedItems && usedItems.length > 0) {
        console.log(`  ${week}  SKIPPED — a duplicate has ${usedItems.length} completed item(s); resolve by hand`);
        continue;
      }

      console.log(`  ${week}  keep ${keeper.week_start}, archive ${losers.map((p) => p.week_start).join(", ")}`);
      for (const loser of losers) toArchive.push({ table, id: loser.id, week_start: loser.week_start });
    }
    console.log("");
  }

  // Grocery lists follow their meal plan's anchor.
  const archivedMealWeeks = toArchive.filter((r) => r.table === "meal_plans").map((r) => r.week_start);
  const { data: staleLists } = await supabase
    .from("grocery_lists")
    .select("id, week_start")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .in("week_start", archivedMealWeeks.length > 0 ? archivedMealWeeks : ["__none__"]);

  const { data: keptLists } = await supabase
    .from("grocery_lists")
    .select("week_start")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .in("week_start", keptMealWeeks.length > 0 ? keptMealWeeks : ["__none__"]);
  const haveLists = new Set((keptLists ?? []).map((l) => l.week_start));
  const missingLists = keptMealWeeks.filter((w) => !haveLists.has(w));

  console.log("--- grocery_lists ---");
  for (const l of staleLists ?? []) console.log(`  archive  ${l.week_start} (belonged to an archived plan)`);
  for (const w of missingLists) console.log(`  generate ${w} (kept plan has no list)`);

  console.log(
    `\nTotals: ${toArchive.length} plan(s) archived, ${(staleLists ?? []).length} grocery list(s) archived, ${missingLists.length} generated`
  );
  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply.");
    return;
  }

  for (const row of toArchive) {
    const { error } = await supabase.from(row.table).update({ status: "archived" }).eq("id", row.id);
    if (error) throw new Error(`archive ${row.table} ${row.week_start} failed: ${error.message}`);
  }
  for (const l of staleLists ?? []) {
    const { error } = await supabase.from("grocery_lists").update({ status: "archived" }).eq("id", l.id);
    if (error) throw new Error(`archive grocery_list ${l.week_start} failed: ${error.message}`);
  }
  const { generateAndSaveGroceryList } = await import("@/domains/grocery/service");
  for (const w of missingLists) {
    const result = await generateAndSaveGroceryList(user.id, supabase, w);
    if (!result.ok) throw new Error(`grocery generation for ${w} failed: ${result.error}`);
    console.log(`  generated grocery list for ${w}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
