/**
 * Applies a validated RecipeContentBatch straight to the recipes table
 * via the service-role client, as an alternative to pushing the
 * generated migration file with the Supabase CLI.
 *
 * Why this exists: generate-migration.ts writes the reviewable SQL
 * artifact (that stays the record of what was added), but actually
 * running it needs `supabase db push`, which this project can't rely on
 * -- the remote schema_migrations history was recorded with different
 * versions than the local migration filenames, so a push would try to
 * replay batches that are already live and insert every recipe twice.
 * Same "operates on rows, doesn't fit the reviewable-SQL-diff model"
 * reasoning as scripts/backfill-recipe-photos.ts.
 *
 * Safe to re-run: skips any recipe whose name already exists, so a
 * partial failure can be resumed without duplicating rows. Always run
 * validate-spec.ts first -- this script deliberately does no validation
 * of its own, so there is exactly one place where those rules live.
 *
 * Invoke: pnpm dlx tsx scripts/recipe-content/apply-batch.ts --spec <path> [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import path from "node:path";
import { pathToFileURL } from "node:url";
import { createScriptAdminClient } from "../lib/admin-client";
import { recipeContentBatchSchema, type RecipeContentBatch } from "@/domains/recipes/content-spec";

async function loadBatchModule(specPath: string): Promise<unknown> {
  const absolute = path.resolve(process.cwd(), specPath);
  const mod = (await import(pathToFileURL(absolute).href)) as { batch?: unknown };
  if (!mod.batch) {
    throw new Error(`${specPath} must have a named export \`batch\` (a RecipeContentBatch object).`);
  }
  return mod.batch;
}

function toRow(recipe: RecipeContentBatch["recipes"][number]) {
  return {
    name: recipe.name,
    meal_type: recipe.mealType,
    cuisine: recipe.cuisine,
    dish_type: recipe.dishType,
    calories: recipe.calories,
    protein_g: recipe.proteinG,
    carbs_g: recipe.carbsG,
    fat_g: recipe.fatG,
    fiber_g: recipe.fiberG ?? null,
    prep_minutes: recipe.prepMinutes,
    cook_minutes: recipe.cookMinutes,
    servings: recipe.servings,
    dietary_tags: recipe.dietaryTags,
    allergens: recipe.allergens,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    storage_instructions: recipe.storageInstructions ?? null,
    photo_url: null,
    status: "active" as const,
  };
}

async function main() {
  const specArgIndex = process.argv.indexOf("--spec");
  const specPath = specArgIndex !== -1 ? process.argv[specArgIndex + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  if (!specPath) {
    console.error("Usage: tsx scripts/recipe-content/apply-batch.ts --spec <path> [--dry-run]");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const batch = recipeContentBatchSchema.parse(await loadBatchModule(specPath));

  const { data: existing, error: readError } = await supabase.from("recipes").select("name");
  if (readError) throw new Error(`Failed to read existing recipes: ${readError.message}`);
  const existingLower = new Set((existing ?? []).map((r) => r.name.toLowerCase()));

  const toInsert = batch.recipes.filter((r) => !existingLower.has(r.name.toLowerCase()));
  const skipped = batch.recipes.length - toInsert.length;

  console.log(`Batch: ${batch.recipes.length} recipe(s); ${toInsert.length} new, ${skipped} already present.`);
  if (dryRun) {
    for (const r of toInsert) console.log(`  would insert: ${r.name} [${r.mealType}/${r.dishType}]`);
    return;
  }
  if (toInsert.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const { error: insertError } = await supabase.from("recipes").insert(toInsert.map(toRow));
  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
  console.log(`Inserted ${toInsert.length} recipe(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
