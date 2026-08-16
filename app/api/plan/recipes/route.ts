import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getAllRecipes } from "@/domains/recipes/service";
import { MEAL_TYPES, type MealType } from "@/domains/mealplan/generate";
import { RECIPE_CUISINES, RECIPE_DISH_TYPES } from "@/domains/recipes/schema";
import type { RecipeCuisine, RecipeDishType } from "@/domains/recipes/types";

/**
 * Bearer-token-authenticated read endpoint for the mobile Plan tab's meal
 * swap picker (Plan-tab-overhaul Phase F) -- lists active recipes,
 * optionally narrowed to a specific meal slot (`mealType`, required by
 * swapMealPlanItem's own mealType match) and/or cuisine (`cuisine`, a
 * real filter here since this is a manual "show me X" browse, unlike
 * generation's soft preference scoring). No pagination -- the full
 * library only runs into the low hundreds (see the recipe-content
 * pipeline's own scale target), well within a single reasonable
 * response.
 */
function isMealType(value: string | null): value is MealType {
  return value !== null && (MEAL_TYPES as readonly string[]).includes(value);
}

function isRecipeCuisine(value: string | null): value is RecipeCuisine {
  return value !== null && (RECIPE_CUISINES as readonly string[]).includes(value);
}

function isRecipeDishType(value: string | null): value is RecipeDishType {
  return value !== null && (RECIPE_DISH_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase } = auth;

  const mealTypeParam = request.nextUrl.searchParams.get("mealType");
  const cuisineParam = request.nextUrl.searchParams.get("cuisine");
  const dishTypeParam = request.nextUrl.searchParams.get("dishType");
  if (mealTypeParam !== null && !isMealType(mealTypeParam)) {
    return NextResponse.json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` }, { status: 400 });
  }
  if (cuisineParam !== null && !isRecipeCuisine(cuisineParam)) {
    return NextResponse.json({ error: `cuisine must be one of ${RECIPE_CUISINES.join(", ")}` }, { status: 400 });
  }
  if (dishTypeParam !== null && !isRecipeDishType(dishTypeParam)) {
    return NextResponse.json({ error: `dishType must be one of ${RECIPE_DISH_TYPES.join(", ")}` }, { status: 400 });
  }

  const allRecipes = await getAllRecipes(supabase);
  const recipes = allRecipes.filter(
    (r) =>
      (mealTypeParam === null || r.mealType === mealTypeParam || r.alsoSuitableFor.includes(mealTypeParam)) &&
      (cuisineParam === null || r.cuisine === cuisineParam) &&
      (dishTypeParam === null || r.dishType === dishTypeParam)
  );

  return NextResponse.json({
    recipes: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      mealType: r.mealType,
      cuisine: r.cuisine,
      dishType: r.dishType,
      alsoSuitableFor: r.alsoSuitableFor,
      calories: r.calories,
      proteinG: r.proteinG,
      allergens: r.allergens,
      photoUrl: r.photoUrl,
    })),
  });
}
