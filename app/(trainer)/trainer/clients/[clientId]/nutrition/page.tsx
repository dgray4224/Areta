import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientNutritionOverview, generateClientMealPlan, approveClientMealPlan } from "@/domains/trainer/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { PlanActions } from "../PlanActions";
import type { MealPlanItemView } from "@/domains/mealplan/service";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export default async function ClientNutritionPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const result = await getClientNutritionOverview(clientId);
  if (!result.ok) notFound();
  const { calorieTarget, proteinTarget, mealPlan } = result.data;

  return (
    <div className="space-y-6">
      <Link href={`/trainer/clients/${clientId}`} className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <h2 className="text-lg font-semibold">Nutrition</h2>

      <Card className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">Calorie target</p>
          <p className="text-sm">{calorieTarget ? `${calorieTarget} cal` : "Not approved yet"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Protein target</p>
          <p className="text-sm">{proteinTarget ? `${proteinTarget} g` : "Not approved yet"}</p>
        </div>
      </Card>

      {!calorieTarget || !proteinTarget ? (
        <p className="text-sm text-neutral-500">
          A meal plan can&apos;t be generated until your client approves their own nutrition targets
          (Plan → Nutrition targets) — that approval step isn&apos;t delegated to trainers in this pass.
        </p>
      ) : (
        <PlanActions
          clientId={clientId}
          hasDraft={mealPlan?.status === "draft"}
          onGenerate={generateClientMealPlan}
          onApprove={approveClientMealPlan}
          generateLabel={mealPlan ? "Regenerate plan" : "Generate meal plan"}
          approveLabel="Approve plan"
        />
      )}

      {!mealPlan || mealPlan.items.length === 0 ? (
        <EmptyState title="No meal plan yet" description="Generate one above once targets are approved." />
      ) : (
        <MealPlanBody items={mealPlan.items} status={mealPlan.status} />
      )}
    </div>
  );
}

async function MealPlanBody({
  items,
  status,
}: {
  items: MealPlanItemView[];
  status: string;
}) {
  const recipeIds = [...new Set(items.map((i) => i.recipeId))];
  const recipesById = await getRecipesByIds(recipeIds);

  const byDay = new Map<number, MealPlanItemView[]>();
  for (const item of items) {
    const arr = byDay.get(item.dayOfWeek) ?? [];
    arr.push(item);
    byDay.set(item.dayOfWeek, arr);
  }

  return (
    <div className="space-y-3">
      <span className="inline-block rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
        {status}
      </span>
      {DAY_NAMES.map((dayName, dayIndex) => {
        const dayItems = (byDay.get(dayIndex) ?? []).sort(
          (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)
        );
        if (dayItems.length === 0) return null;
        return (
          <Card key={dayIndex}>
            <p className="mb-2 text-sm font-medium">{dayName}</p>
            <ul className="space-y-1 text-sm">
              {dayItems.map((item) => (
                <li key={item.id} className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="capitalize">{item.mealType}</span>
                  <span>{recipesById.get(item.recipeId)?.name ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
