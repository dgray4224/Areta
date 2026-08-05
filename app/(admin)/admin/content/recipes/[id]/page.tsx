import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeAdmin } from "@/domains/recipes/service";
import { RecipeForm } from "../RecipeForm";
import type { RecipeInput } from "@/domains/recipes/schema";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipeAdmin(id);
  if (!recipe) notFound();

  const defaultValues: Partial<RecipeInput> = {
    name: recipe.name,
    mealType: recipe.mealType,
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG,
    fatG: recipe.fatG,
    fiberG: recipe.fiberG ?? undefined,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    servings: recipe.servings,
    dietaryTags: recipe.dietaryTags,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    storageInstructions: recipe.storageInstructions ?? undefined,
    status: recipe.status,
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/content/recipes" className="text-sm text-neutral-500 hover:underline">
        ← Recipes
      </Link>
      <h2 className="text-lg font-semibold">{recipe.name}</h2>
      <RecipeForm mode="edit" recipeId={recipe.id} defaultValues={defaultValues} />
    </div>
  );
}
