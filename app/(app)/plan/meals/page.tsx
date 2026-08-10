import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { RecipePhoto } from "@/platform/ui/RecipePhoto";
import { getMealPlanForWeek, type MealPlanItemView } from "@/domains/mealplan/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { GenerateMealPlanButton } from "./GenerateMealPlanButton";
import { ApprovePlanButton } from "./ApprovePlanButton";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export default async function MealsPage() {
  const user = await requireUser();
  const plan = await getMealPlanForWeek(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/plan/setup" className="text-sm text-neutral-500 hover:underline">
        ← Back to plan
      </Link>
      <h1 className="text-2xl font-semibold">Meal plan</h1>

      {!plan || plan.items.length === 0 ? (
        <EmptyState
          title="No meal plan yet"
          description="Approve your nutrition targets first, then generate a 7-day plan from the recipe library."
          action={<GenerateMealPlanButton userId={user.id} />}
        />
      ) : (
        <MealPlanBody userId={user.id} plan={plan} />
      )}
    </div>
  );
}

async function MealPlanBody({
  userId,
  plan,
}: {
  userId: string;
  plan: NonNullable<Awaited<ReturnType<typeof getMealPlanForWeek>>>;
}) {
  const recipeIds = [...new Set(plan.items.map((i) => i.recipeId))];
  const recipes = await getRecipesByIds(recipeIds);

  const byDay = new Map<number, MealPlanItemView[]>();
  for (const item of plan.items) {
    const arr = byDay.get(item.dayOfWeek) ?? [];
    arr.push(item);
    byDay.set(item.dayOfWeek, arr);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Target: {plan.calorieTarget} kcal · {plan.proteinTarget}g protein per day
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
            plan.status === "active"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          }`}
        >
          {plan.status === "active" ? "Active" : "Draft"}
        </span>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 7 }, (_, day) => day).map((day) => {
          const items = (byDay.get(day) ?? [])
            .slice()
            .sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));
          const dayTotalCalories = items.reduce(
            (sum, i) => sum + (recipes.get(i.recipeId)?.calories ?? 0) * i.servings,
            0
          );
          return (
            <div
              key={day}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p className="font-medium">{DAY_NAMES[day]}</p>
              <ul className="mt-2 space-y-2 text-sm">
                {items.map((item) => {
                  const recipe = recipes.get(item.recipeId);
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-4">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <RecipePhoto url={recipe?.photoUrl ?? null} size={36} className="shrink-0" />
                        <span className="shrink-0 capitalize text-neutral-500">{item.mealType}</span>
                      </span>
                      <span className="min-w-0 text-right">
                        {recipe?.name ?? "Unknown recipe"}
                        {recipe ? (
                          <span className="text-neutral-400">
                            {" "}
                            ({recipe.calories} kcal, {recipe.proteinG}g protein)
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-neutral-400">
                ~{Math.round(dayTotalCalories)} kcal for the day
              </p>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <GenerateMealPlanButton userId={userId} label="Regenerate plan" />
        {plan.status !== "active" ? (
          <ApprovePlanButton userId={userId} />
        ) : (
          <p className="text-sm text-neutral-500">
            Approved. See your{" "}
            <Link href="/plan/grocery" className="underline">
              grocery list
            </Link>{" "}
            and{" "}
            <Link href="/plan/prep" className="underline">
              Sunday prep plan
            </Link>
            .
          </p>
        )}
      </div>
    </>
  );
}
