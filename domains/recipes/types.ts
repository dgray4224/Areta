export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  section: string;
};

export type RecipeStatus = "active" | "review" | "deprecated";

export type Recipe = {
  id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  dietaryTags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  storageInstructions: string | null;
  status: RecipeStatus;
};
