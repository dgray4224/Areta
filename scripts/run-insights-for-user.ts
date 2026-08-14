/**
 * Ops helper: run the Insight Engine v2 detector battery once for one
 * user, with pattern scans enabled — exactly what the generate-insights
 * cron does on that user's weekly_review_day, minus the schedule. Useful
 * for verifying against real data and for backfilling a first batch of
 * insights before the cron's next natural run. Idempotent (dedupe_key),
 * so re-running is always safe.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/run-insights-for-user.ts <email>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { computeAndStoreInsights } from "@/domains/insights/service";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: run-insights-for-user.ts <email>");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = userList?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user with email ${email}`);

  const result = await computeAndStoreInsights(user.id, supabase, { includePatternScans: true });
  console.log(`created: ${result.created}, duplicates (already fired): ${result.duplicates}`);

  const { data: rows } = await supabase
    .from("insights")
    .select("type, status, headline, score, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const row of rows ?? []) {
    console.log(`  [${row.type}] (${row.status}, score ${row.score}) ${row.headline}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
