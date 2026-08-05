import Link from "next/link";
import { RecipeForm } from "../RecipeForm";

export default function NewRecipePage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/content/recipes" className="text-sm text-neutral-500 hover:underline">
        ← Recipes
      </Link>
      <h2 className="text-lg font-semibold">New recipe</h2>
      <RecipeForm mode="create" />
    </div>
  );
}
