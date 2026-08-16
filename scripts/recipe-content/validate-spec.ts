/**
 * Structural + computed-consistency validation for a RecipeContentBatch
 * draft (see docs/recipe-content-pipeline.md). This is the recipe
 * pipeline's entire safety net -- there is no verify-sources step and no
 * manual review gate (see domains/recipes/content-spec.ts's comment for
 * why), so this script has to catch what those would otherwise catch:
 * obviously-wrong macros, implausible calorie counts, and allergen/
 * dietary-tag claims that don't match the ingredient list.
 *
 * Invoke standalone: pnpm dlx tsx scripts/recipe-content/validate-spec.ts --spec <path-to-batch-module>
 * The batch module must have a named export `batch: RecipeContentBatch`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import path from "node:path";
import { pathToFileURL } from "node:url";
import { createScriptAdminClient } from "../lib/admin-client";
import { recipeContentBatchSchema, type RecipeContentBatch, type NewRecipeSpec } from "@/domains/recipes/content-spec";
import { ALLERGEN_KEYWORDS, MEAT_KEYWORDS, VEGAN_EXTRA_EXCLUDE_KEYWORDS } from "./allergen-keywords";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { RecipeAllergen } from "@/domains/recipes/types";

export type ValidationResult = { ok: boolean; errors: string[] };

/** Meal-type-appropriate calorie bounds -- loose on purpose (this is a
 * plausibility check, not a nutritionist's guideline), just tight enough
 * to catch a recipe with obviously wrong-order-of-magnitude numbers (e.g.
 * a 1800-calorie "snack"). */
const CALORIE_RANGE: Record<NewRecipeSpec["mealType"], [number, number]> = {
  breakfast: [200, 700],
  lunch: [300, 800],
  dinner: [350, 950],
  snack: [50, 400],
};

function ingredientText(recipe: NewRecipeSpec): string {
  return recipe.ingredients.map((i) => i.name).join(" | ").toLowerCase();
}

/** Per-keyword exclusion prefixes -- a compound term that contains a
 * keyword as its own word but doesn't actually imply that allergen.
 * "peanut butter" isn't the dairy allergen "butter"; "corn tortilla" is
 * naturally wheat-free unlike a generic/flour tortilla. Same class of
 * false positive as "eggplant" matching "egg" -- word-boundary matching
 * alone doesn't catch these because the excluded word really is its own
 * token, just one that changes what the following word means. */
const KEYWORD_EXCLUDE_PREFIXES: Partial<Record<string, string[]>> = {
  butter: ["peanut", "almond", "cashew", "sunflower seed", "soy nut", "cocoa", "shea"],
  tortilla: ["corn"],
  noodle: ["rice", "glass", "cellophane", "mung bean"],
  flour: ["rice", "corn", "almond", "coconut", "oat", "chickpea", "buckwheat", "potato", "tapioca", "cassava"],
  // Plant milks aren't the dairy allergen "milk" -- same false-positive
  // shape as "peanut butter"/"corn tortilla" above.
  milk: ["soy", "almond", "oat", "coconut", "rice", "cashew", "hemp", "pea"],
};

/** The mirror image of KEYWORD_EXCLUDE_PREFIXES: a compound term where
 * the keyword comes FIRST and the following word changes what it means.
 * "Goat cheese" is dairy, not the meat keyword "goat" — without this, a
 * perfectly vegetarian salad fails the vegetarian check. Kept separate
 * from the prefix map rather than merged, because the regex has to look
 * the other way (lookahead, not lookbehind). */
const KEYWORD_EXCLUDE_SUFFIXES: Partial<Record<string, string[]>> = {
  goat: ["cheese"],
  // Oyster mushrooms are a fungus named for their shape, not shellfish --
  // and they're a common meat substitute, so without this a genuinely
  // vegan recipe fails both the allergen and the vegan check. Note that
  // oyster SAUCE really does contain oyster extract and must still be
  // caught, which is why this excludes only the "mushroom" suffix.
  oyster: ["mushroom"],
};

/** Word-boundary match (allowing a trailing "s"/"es" plural), not a plain
 * substring check -- "eggplant" must not match the "egg" keyword the way
 * a naive `.includes()` would, while "Eggs" still must match "egg". Each
 * keyword may itself contain spaces (e.g. "ramen noodle"), so the
 * boundary is anchored on the whole keyword phrase, not per-word. */
function matchesAny(text: string, keywords: string[]): string | null {
  return (
    keywords.find((k) => {
      const excludePrefixes = KEYWORD_EXCLUDE_PREFIXES[k];
      const lookbehinds = excludePrefixes ? excludePrefixes.map((p) => `(?<!${escapeRegExp(p)} )`).join("") : "";
      const excludeSuffixes = KEYWORD_EXCLUDE_SUFFIXES[k];
      const lookaheads = excludeSuffixes ? excludeSuffixes.map((suffix) => `(?! ${escapeRegExp(suffix)})`).join("") : "";
      return new RegExp(`${lookbehinds}\\b${escapeRegExp(k)}(e?s)?\\b${lookaheads}`).test(text);
    }) ?? null
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cross-references an already Zod-valid batch against the live DB plus
 * the batch's own internal consistency. Pure validation only -- never
 * writes anything.
 */
export async function crossReferenceBatch(
  batch: RecipeContentBatch,
  supabase: SupabaseClient<Database>
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Name uniqueness: within the batch, and against every recipe already
  // in the DB (case-insensitive) -- this pipeline is purely additive, so
  // a colliding name is always a mistake, never an intended replacement.
  const namesLower = batch.recipes.map((r) => r.name.toLowerCase());
  const duplicateNames = namesLower.filter((n, i) => namesLower.indexOf(n) !== i);
  for (const name of new Set(duplicateNames)) {
    errors.push(`Duplicate recipe name within this batch: "${name}"`);
  }

  const { data: existing, error } = await supabase.from("recipes").select("name");
  if (error) throw new Error(`Failed to check existing recipe names: ${error.message}`);
  const existingNamesLower = new Set((existing ?? []).map((r) => r.name.toLowerCase()));
  for (const recipe of batch.recipes) {
    if (existingNamesLower.has(recipe.name.toLowerCase())) {
      errors.push(`Recipe name already exists in the library: "${recipe.name}"`);
    }
  }

  for (const recipe of batch.recipes) {
    const label = `Recipe "${recipe.name}"`;
    const text = ingredientText(recipe);

    // Macro-math consistency: calories should roughly equal
    // 4*protein + 4*carbs + 9*fat. Tolerance is generous (the greater of
    // 50 kcal or 15% of stated calories) since real recipes round --
    // this is meant to catch arithmetic errors, not nitpick rounding.
    const computedCalories = 4 * recipe.proteinG + 4 * recipe.carbsG + 9 * recipe.fatG;
    const tolerance = Math.max(50, 0.15 * recipe.calories);
    if (Math.abs(recipe.calories - computedCalories) > tolerance) {
      errors.push(
        `${label}: stated calories (${recipe.calories}) don't match macros (${recipe.proteinG}p/${recipe.carbsG}c/${recipe.fatG}f ≈ ${Math.round(computedCalories)} kcal) within tolerance (±${Math.round(tolerance)})`
      );
    }

    // alsoSuitableFor must not repeat mealType -- the DB has the same
    // CHECK, but failing here names the recipe instead of surfacing a
    // constraint violation halfway through a batch insert.
    if (recipe.alsoSuitableFor?.includes(recipe.mealType)) {
      errors.push(`${label}: alsoSuitableFor repeats its own mealType ("${recipe.mealType}")`);
    }
    const crossover = recipe.alsoSuitableFor ?? [];
    if (new Set(crossover).size !== crossover.length) {
      errors.push(`${label}: alsoSuitableFor contains duplicates`);
    }

    // Meal-type-appropriate calorie range.
    const [min, max] = CALORIE_RANGE[recipe.mealType];
    if (recipe.calories < min || recipe.calories > max) {
      errors.push(`${label}: ${recipe.calories} calories is outside the plausible range for ${recipe.mealType} (${min}-${max})`);
    }

    // Allergen cross-check: every Big-9 allergen implied by an ingredient
    // name must be tagged.
    for (const allergen of Object.keys(ALLERGEN_KEYWORDS) as RecipeAllergen[]) {
      const hit = matchesAny(text, ALLERGEN_KEYWORDS[allergen]);
      if (hit && !recipe.allergens.includes(allergen)) {
        errors.push(`${label}: ingredient matching "${hit}" implies allergen "${allergen}", which isn't in allergens`);
      }
    }

    // Dietary-tag sanity check: a "vegetarian"/"vegan" claim shouldn't be
    // contradicted by an ingredient that's obviously meat/fish/dairy/egg.
    const tags = recipe.dietaryTags.map((t) => t.toLowerCase());
    if (tags.includes("vegetarian") || tags.includes("vegan")) {
      const meatHit = matchesAny(text, MEAT_KEYWORDS);
      if (meatHit) {
        errors.push(`${label}: tagged "${tags.includes("vegan") ? "vegan" : "vegetarian"}" but an ingredient matches "${meatHit}"`);
      }
    }
    if (tags.includes("vegan")) {
      const veganHit = matchesAny(text, VEGAN_EXTRA_EXCLUDE_KEYWORDS);
      if (veganHit) {
        errors.push(`${label}: tagged "vegan" but an ingredient matches "${veganHit}"`);
      }
    }
    if (tags.includes("gluten-free")) {
      const wheatHit = matchesAny(text, ALLERGEN_KEYWORDS.wheat);
      if (wheatHit) {
        errors.push(`${label}: tagged "gluten-free" but an ingredient matches "${wheatHit}"`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function validateContentBatch(
  rawBatch: unknown,
  supabase: SupabaseClient<Database>
): Promise<ValidationResult> {
  const parsed = recipeContentBatchSchema.safeParse(rawBatch);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  return crossReferenceBatch(parsed.data, supabase);
}

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
    console.error("Usage: tsx scripts/recipe-content/validate-spec.ts --spec <path-to-batch-module>");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const rawBatch = await loadBatchModule(specPath);
  const result = await validateContentBatch(rawBatch, supabase);

  if (result.ok) {
    console.log("validate-spec: OK");
  } else {
    console.error(`validate-spec: ${result.errors.length} error(s):`);
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
