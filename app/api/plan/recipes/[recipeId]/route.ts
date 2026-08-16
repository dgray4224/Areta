import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getRecipesByIds } from "@/domains/recipes/service";

/**
 * Bearer-token-authenticated detail read for one recipe — the full
 * ingredients + instructions the list endpoint deliberately omits, for
 * mobile's "tap a meal photo to see how to make it" sheet (Today ->
 * Nutrition). Kept a separate route rather than widening
 * /api/plan/recipes because that one returns the whole active library in
 * a single unpaginated response; folding prep text into every row there
 * would multiply its payload for a picker that never displays it.
 *
 * Status-unfiltered via getRecipesByIds (not getAllRecipes) on purpose:
 * a recipe already sitting in someone's saved plan must still open even
 * if it was deprecated after being planned — same reasoning as that
 * helper's own doc comment.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ recipeId: string }> }) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase } = auth;
  const { recipeId } = await params;

  if (!recipeId) {
    return NextResponse.json({ error: "recipeId is required" }, { status: 400 });
  }

  const recipe = (await getRecipesByIds([recipeId], supabase)).get(recipeId);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({
    recipe: {
      id: recipe.id,
      name: recipe.name,
      mealType: recipe.mealType,
      cuisine: recipe.cuisine,
      dishType: recipe.dishType,
      alsoSuitableFor: recipe.alsoSuitableFor,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
      fiberG: recipe.fiberG,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      servings: recipe.servings,
      dietaryTags: recipe.dietaryTags,
      allergens: recipe.allergens,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      storageInstructions: recipe.storageInstructions,
      photoUrl: recipe.photoUrl,
    },
  });
}
