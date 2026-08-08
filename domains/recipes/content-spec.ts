import { z } from "zod";
import { recipeSchema } from "@/domains/recipes/schema";

/**
 * Typed format for hand-drafting new recipe content (see
 * docs/recipe-content-pipeline.md), mirroring domains/trainingprogram/
 * content-spec.ts's ContentBatch pattern -- a typed batch validated before
 * any SQL is generated, so a hand-typed-tuple arity bug (the original
 * motivation for that pipeline) can't happen here either.
 *
 * Deliberately pure -- no "use server", no platform/supabase/server
 * import -- so both the app and scripts/recipe-content/*.ts (which run
 * outside Next's bundler via plain tsx) can import this directly.
 *
 * One deliberate difference from the training-content pipeline: recipes
 * have no source-citation/verify-sources step. A training program cites a
 * specialist's methodology; a recipe doesn't cite anyone -- its safety net
 * is scripts/recipe-content/validate-spec.ts's computed checks (macro-math
 * consistency, meal-type-appropriate ranges, allergen/dietary-tag keyword
 * cross-checks against the ingredient list), not URL verification. See
 * docs/recipe-content-pipeline.md for the full reasoning.
 */
export const newRecipeSchema = recipeSchema.omit({ status: true });
export type NewRecipeSpec = z.infer<typeof newRecipeSchema>;

export const recipeContentBatchSchema = z.object({
  recipes: z.array(newRecipeSchema).min(1),
});
export type RecipeContentBatch = z.infer<typeof recipeContentBatchSchema>;
