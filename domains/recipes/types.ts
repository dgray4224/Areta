import type { RECIPE_ALLERGENS, RECIPE_CUISINES } from "@/domains/recipes/schema";

export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  section: string;
};

export type RecipeStatus = "active" | "review" | "deprecated";
export type RecipeCuisine = (typeof RECIPE_CUISINES)[number];
export type RecipeAllergen = (typeof RECIPE_ALLERGENS)[number];

export type Recipe = {
  id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  cuisine: RecipeCuisine;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  dietaryTags: string[];
  allergens: RecipeAllergen[];
  ingredients: Ingredient[];
  instructions: string[];
  storageInstructions: string | null;
  photoUrl: string | null;
  status: RecipeStatus;
};
