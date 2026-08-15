/**
 * Ops helper: recompute one user's insights and UPDATE the `facts` and
 * `headline` of rows that already exist, matched on dedupe_key.
 *
 * Why this exists: the normal engine path (computeAndStoreInsights) is
 * insert-only — it drops any candidate whose dedupe_key already fired, so
 * an insight created before share-card series data existed can never gain
 * one by re-running the cron. This backfills those rows in place so their
 * cards render the archetype visual instead of degrading to text-only.
 *
 * Only touches rows whose dedupe_key the detectors still produce today,
 * and never inserts, deletes, or changes status/seen_at/shared_at — a
 * dismissed insight stays dismissed. Pass --dry-run first.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/refresh-insight-facts.ts <email> [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { computeInsightCandidates } from "@/domains/insights/service";

async function main() {
  const email = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!email) {
    console.error("Usage: refresh-insight-facts.ts <email> [--dry-run]");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = userList?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user with email ${email}`);

  const candidates = await computeInsightCandidates(user.id, supabase, { includePatternScans: true });
  const byKey = new Map(candidates.map((c) => [c.dedupeKey, c]));
  console.log(`${candidates.length} candidate(s) recomputed for ${email}`);

  const { data: rows, error } = await supabase
    .from("insights")
    .select("id, dedupe_key, headline")
    .eq("user_id", user.id);
  if (error) throw new Error(`fetch failed: ${error.message}`);

  let updated = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    const candidate = byKey.get(row.dedupe_key);
    // A row whose detector no longer produces this key (data moved on, or
    // the insight was a one-off) has nothing authoritative to refresh
    // from — leave it exactly as it is rather than guessing.
    if (!candidate) {
      skipped++;
      continue;
    }
    console.log(`${dryRun ? "[dry-run] " : ""}${row.dedupe_key}`);
    console.log(`    old: ${row.headline}`);
    console.log(`    new: ${candidate.headline}`);
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("insights")
        .update({ facts: candidate.facts, headline: candidate.headline })
        .eq("id", row.id);
      if (updateError) throw new Error(`update failed for ${row.dedupe_key}: ${updateError.message}`);
    }
    updated++;
  }

  console.log(`\n${dryRun ? "would update" : "updated"}: ${updated}, left untouched: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
