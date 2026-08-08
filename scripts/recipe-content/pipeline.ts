/**
 * Thin orchestrator for the recipe content pipeline (see
 * docs/recipe-content-pipeline.md): validate -> generate-migration,
 * stopping at the first failure. Two steps, not three -- unlike
 * scripts/training-content/pipeline.ts, there is no verify-sources step
 * here (see domains/recipes/content-spec.ts's comment for why recipes
 * don't carry source citations to verify).
 *
 * Invoke: pnpm run content:add-recipes -- --spec <path-to-batch-module> [--label <label>]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import path from "node:path";
import { pathToFileURL } from "node:url";
import { createScriptAdminClient } from "../lib/admin-client";
import { recipeContentBatchSchema } from "@/domains/recipes/content-spec";
import { validateContentBatch } from "./validate-spec";
import { generateMigrationFile } from "./generate-migration";

async function loadBatchModule(specPath: string): Promise<unknown> {
  const absolute = path.resolve(process.cwd(), specPath);
  const mod = (await import(pathToFileURL(absolute).href)) as { batch?: unknown };
  if (!mod.batch) {
    throw new Error(`${specPath} must have a named export \`batch\` (a RecipeContentBatch object).`);
  }
  return mod.batch;
}

async function main() {
  const specArgIndex = process.argv.indexOf("--spec");
  const specPath = specArgIndex !== -1 ? process.argv[specArgIndex + 1] : undefined;
  if (!specPath) {
    console.error("Usage: pnpm run content:add-recipes -- --spec <path-to-batch-module> [--label <label>]");
    process.exit(1);
  }
  const labelArgIndex = process.argv.indexOf("--label");
  const label = labelArgIndex !== -1 ? process.argv[labelArgIndex + 1] : undefined;

  const supabase = createScriptAdminClient();
  const rawBatch = await loadBatchModule(specPath);

  console.log("Step 1/2: validate-spec");
  const validation = await validateContentBatch(rawBatch, supabase);
  if (!validation.ok) {
    console.error(`  ${validation.errors.length} error(s):`);
    for (const err of validation.errors) console.error(`    - ${err}`);
    process.exit(1);
  }
  console.log("  OK");

  const batch = recipeContentBatchSchema.parse(rawBatch);

  console.log("Step 2/2: generate-migration");
  const filePath = generateMigrationFile(batch, label);
  console.log(`  Wrote ${filePath}`);
  console.log("\nReview the file, then run: pnpm dlx supabase db push --linked");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
