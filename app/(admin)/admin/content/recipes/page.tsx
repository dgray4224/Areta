import Link from "next/link";
import { listRecipesAdmin } from "@/domains/recipes/service";
import type { RecipeStatus } from "@/domains/recipes/types";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { StatusTabs } from "../../StatusTabs";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "review", label: "Review" },
  { value: "deprecated", label: "Deprecated" },
] as const;

export default async function RecipesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const recipes = await listRecipesAdmin(status && status !== "all" ? (status as RecipeStatus) : undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusTabs basePath="/admin/content/recipes" options={STATUS_OPTIONS} current={status ?? "all"} />
        <LinkButton href="/admin/content/recipes/new" variant="secondary">
          + New recipe
        </LinkButton>
      </div>

      {recipes.length === 0 ? (
        <EmptyState title="No recipes here" description="Nothing matches this filter yet." />
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/admin/content/recipes/${recipe.id}`}>
              <Card className="flex items-center justify-between hover:border-brand/40">
                <div>
                  <p className="font-medium">{recipe.name}</p>
                  <p className="text-xs text-neutral-500">
                    {recipe.mealType} · {recipe.calories} cal · {recipe.proteinG}g protein
                  </p>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
                  {recipe.status}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
