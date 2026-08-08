import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  section: z.string().min(1, "Grocery section is required"),
});
export type IngredientInput = z.infer<typeof ingredientSchema>;

/** The 8 cuisines Americans most commonly eat, per NRA "Global Palates",
 * YouGov, and Google search-volume data (see migration
 * 0096_recipes_cuisine_allergens_photo.sql's comment for the sourcing) —
 * deliberately not a long tail of every possible cuisine, since this is a
 * US-first launch. */
export const RECIPE_CUISINES = [
  "american",
  "italian",
  "mexican",
  "chinese",
  "japanese",
  "thai",
  "indian",
  "mediterranean",
] as const;

/** FDA "Big 9" major food allergens — a fixed vocabulary, not free text
 * like dietaryTags, so it stays filterable and so the recipe-content
 * pipeline's allergen cross-check (scripts/recipe-content/validate-spec.ts)
 * has something checkable to cross-reference ingredient names against. */
export const RECIPE_ALLERGENS = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "tree_nuts",
  "peanuts",
  "wheat",
  "soybeans",
  "sesame",
] as const;

// No `.default([])` here — see domains/expertregistry/schema.ts's comment
// on the same pattern: keeping the array's input/output type identical is
// what lets zodResolver and useForm<RecipeInput>()'s single generic agree.
const stringArray = z.array(z.string());

export const recipeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  cuisine: z.enum(RECIPE_CUISINES),
  calories: z.number().int().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0).optional(),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  servings: z.number().int().min(1),
  dietaryTags: stringArray,
  allergens: z.array(z.enum(RECIPE_ALLERGENS)),
  ingredients: z.array(ingredientSchema).min(1, "Add at least one ingredient"),
  instructions: z.array(z.string().min(1, "Step can't be empty")).min(1, "Add at least one step"),
  storageInstructions: z.string().optional(),
  photoUrl: z.string().url().optional(),
  status: z.enum(["active", "review", "deprecated"]),
});
export type RecipeInput = z.infer<typeof recipeSchema>;

/** react-hook-form's `useFieldArray` needs an array of objects to key by,
 * which `instructions: string[]` isn't, and forcing it into that shape
 * just to satisfy the hook would make the field's real submitted type
 * (string[]) diverge from what zodResolver validates against — the same
 * class of problem `csvToArray` solves for comma-separated fields
 * elsewhere. Simpler here: the form manages ingredients/instructions as
 * plain component state (see RecipeForm), validated only against the
 * full recipeSchema server-side; zodResolver only needs to cover the
 * scalar fields for client-side inline errors. */
export const recipeScalarSchema = recipeSchema.omit({ ingredients: true, instructions: true });
export type RecipeScalarInput = z.infer<typeof recipeScalarSchema>;
