import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { getNutritionParameters } from "@/domains/parameters/service";
import { getMealPlanForWeek } from "@/domains/mealplan/service";
import { getGroceryListForWeek } from "@/domains/grocery/service";
import { getPrepPlanForWeek } from "@/domains/prep/service";

function StatusBadge({ status }: { status: "not_started" | "pending" | "done" }) {
  const styles = {
    not_started: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  };
  const labels = { not_started: "Not started", pending: "In progress", done: "Ready" };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default async function PlanPage() {
  const user = await requireUser();
  const [parameters, mealPlan, groceryItems, prepPlan] = await Promise.all([
    getNutritionParameters(user.id),
    getMealPlanForWeek(user.id),
    getGroceryListForWeek(user.id),
    getPrepPlanForWeek(user.id),
  ]);

  const parametersStatus =
    parameters.length === 0
      ? "not_started"
      : parameters.every((p) => p.approved)
        ? "done"
        : "pending";
  const mealPlanStatus =
    !mealPlan || mealPlan.items.length === 0
      ? "not_started"
      : mealPlan.status === "active"
        ? "done"
        : "pending";
  const groceryStatus = groceryItems.length === 0 ? "not_started" : "done";
  const prepStatus = !prepPlan || prepPlan.steps.length === 0 ? "not_started" : "done";

  const steps = [
    {
      href: "/plan/parameters",
      title: "1. Nutrition targets",
      description: "Calorie, protein, and macro targets calculated from your onboarding answers.",
      status: parametersStatus,
    },
    {
      href: "/plan/meals",
      title: "2. Meal plan",
      description: "A 7-day plan built from your targets, preferences, and the recipe library.",
      status: mealPlanStatus,
    },
    {
      href: "/plan/grocery",
      title: "3. Grocery list",
      description: "Combined ingredients for the week, grouped by store section.",
      status: groceryStatus,
    },
    {
      href: "/plan/prep",
      title: "4. Sunday prep plan",
      description: "An ordered cooking and portioning workflow for the week's meals.",
      status: prepStatus,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">This week&apos;s plan</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          LifeOS derives your nutrition targets, then builds a meal plan, grocery list, and Sunday
          prep plan from them — in order, each one reviewable before it goes live.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {step.description}
              </p>
            </div>
            <StatusBadge status={step.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
