/**
 * Thin orchestrator for the on-demand content pipeline (see
 * docs/training-content-pipeline.md): validate -> verify-sources ->
 * generate-migration, stopping at the first failure. This is the single
 * entry point for turning a drafted ContentBatch into a reviewable
 * migration file.
 *
 * Invoke: pnpm run content:add -- --spec <path-to-batch-module> [--label <label>]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import path from "node:path";
import { pathToFileURL } from "node:url";
import { createScriptAdminClient } from "../lib/admin-client";
import { contentBatchSchema } from "@/domains/trainingprogram/content-spec";
import { validateContentBatch } from "./validate-spec";
import { verifySourceUrls } from "./verify-sources";
import { generateMigrationFile } from "./generate-migration";

async function loadBatchModule(specPath: string): Promise<unknown> {
  const absolute = path.resolve(process.cwd(), specPath);
  const mod = (await import(pathToFileURL(absolute).href)) as { batch?: unknown };
  if (!mod.batch) {
    throw new Error(`${specPath} must have a named export \`batch\` (a ContentBatch object).`);
  }
  return mod.batch;
}

async function main() {
  const specArgIndex = process.argv.indexOf("--spec");
  const specPath = specArgIndex !== -1 ? process.argv[specArgIndex + 1] : undefined;
  if (!specPath) {
    console.error("Usage: pnpm run content:add -- --spec <path-to-batch-module> [--label <label>]");
    process.exit(1);
  }
  const labelArgIndex = process.argv.indexOf("--label");
  const label = labelArgIndex !== -1 ? process.argv[labelArgIndex + 1] : undefined;

  const supabase = createScriptAdminClient();
  const rawBatch = await loadBatchModule(specPath);

  console.log("Step 1/3: validate-spec");
  const validation = await validateContentBatch(rawBatch, supabase);
  if (!validation.ok) {
    console.error(`  ${validation.errors.length} error(s):`);
    for (const err of validation.errors) console.error(`    - ${err}`);
    process.exit(1);
  }
  console.log("  OK");

  const batch = contentBatchSchema.parse(rawBatch);

  console.log("Step 2/3: verify-sources");
  const sourceCheck = await verifySourceUrls(batch);
  for (const r of sourceCheck.results) {
    console.log(`  ${r.ok ? "OK  " : "FAIL"} ${r.url}${r.reason ? ` -- ${r.reason}` : ""}`);
  }
  if (!sourceCheck.ok) {
    console.error("  One or more sources failed the credibility gate. No migration was generated.");
    process.exit(1);
  }

  console.log("Step 3/3: generate-migration");
  const filePath = generateMigrationFile(batch, label);
  console.log(`  Wrote ${filePath}`);
  console.log("\nReview the file, then run: pnpm dlx supabase db push --linked");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
