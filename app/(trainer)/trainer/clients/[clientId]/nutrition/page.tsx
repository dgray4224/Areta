import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getClientNutritionOverview,
  getClientMealProgramAssignment,
  listClientMealAssignmentHistory,
} from "@/domains/trainer/service";
import { listMyMealPrograms } from "@/domains/trainermealprogram/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { ApproveNutritionButton } from "./ApproveNutritionButton";
import { AssignedMealProgramPanel } from "./AssignedMealProgramPanel";
import { AssignMealProgramForm } from "./AssignMealProgramForm";
import { PastMealProgramsList } from "./PastMealProgramsList";
import type { MealPlanItemView } from "@/domains/mealplan/service";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export default async function ClientNutritionPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const [result, assignment, allPrograms, historyResult] = await Promise.all([
    getClientNutritionOverview(clientId),
    getClientMealProgramAssignment(clientId),
    listMyMealPrograms(),
    listClientMealAssignmentHistory(clientId),
  ]);
  if (!result.ok) notFound();
  const { calorieTarget, proteinTarget, parameters, mealPlan } = result.data;
  const unapproved = parameters.filter((p) => !p.approved);
  const publishedPrograms = allPrograms.filter((p) => p.status === "published");
  const history = historyResult.ok ? historyResult.data : [];

  return (
    <div className="space-y-6">
      <Link href={`/trainer/clients/${clientId}`} className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <h2 className="text-lg font-semibold">Nutrition</h2>

      <Card className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">Calorie target (daily)</p>
          <p className="text-sm">{calorieTarget ? `${calorieTarget.toLocaleString()} cal/day` : "Not approved yet"}</p>
          {calorieTarget ? (
            <p className="text-xs text-neutral-500">{(calorieTarget * 7).toLocaleString()} cal/week</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Protein target (daily)</p>
          <p className="text-sm">{proteinTarget ? `${proteinTarget.toLocaleString()} g/day` : "Not approved yet"}</p>
          {proteinTarget ? (
            <p className="text-xs text-neutral-500">{(proteinTarget * 7).toLocaleString()} g/week</p>
          ) : null}
        </div>
      </Card>

      {parameters.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No nutrition parameters generated yet — that needs your client&apos;s onboarding answers, so it
          has to happen on their end first (Plan → Nutrition targets).
        </p>
      ) : unapproved.length > 0 ? (
        <Card className="space-y-2">
          <p className="text-sm font-medium">{unapproved.length} target(s) awaiting approval</p>
          <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {unapproved.map((p) => (
              <li key={p.dbId}>
                {p.name.replace(/_/g, " ")}: {String(p.value)}
                {p.unit ? ` ${p.unit}` : ""}
              </li>
            ))}
          </ul>
          <ApproveNutritionButton clientId={clientId} />
        </Card>
      ) : null}

      {assignment ? (
        <AssignedMealProgramPanel clientId={clientId} assignment={assignment} programs={publishedPrograms} />
      ) : (
        <Card>
          <p className="mb-2 text-sm font-medium">Assign one of your nutrition programs</p>
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Build a program under{" "}
            <Link href="/trainer/meal-programs" className="underline">
              Your nutrition programs
            </Link>
            , then assign it here.
          </p>
          <AssignMealProgramForm clientId={clientId} programs={publishedPrograms} />
        </Card>
      )}

      {history.length > 0 ? (
        <PastMealProgramsList clientId={clientId} history={history} programs={publishedPrograms} />
      ) : null}

      {mealPlan && mealPlan.items.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">
            {assignment
              ? "This client's currently active meal plan — assigning a program above doesn't regenerate it yet; that's coming in a later update."
              : "This client's currently active meal plan."}
          </p>
          <MealPlanBody items={mealPlan.items} status={mealPlan.status} />
        </div>
      ) : !assignment ? (
        <EmptyState title="No meal plan yet" description="Assign a program above to get started." />
      ) : null}
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
