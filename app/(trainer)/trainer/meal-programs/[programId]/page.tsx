import Link from "next/link";
import { notFound } from "next/navigation";
import { getMealProgramWithPhases, getPhaseHydrated, getRecipesForTrainer } from "@/domains/trainermealprogram/service";
import { Card } from "@/platform/ui/Card";
import { ProgramDetailsEditor } from "./ProgramDetailsEditor";
import { ProgramStatusActions } from "./ProgramStatusActions";
import { AddPhaseForm } from "./AddPhaseForm";
import { PhaseHeader } from "./PhaseHeader";
import { AddMealForm, MealRow } from "./MealForm";
import type { HydratedTrainerMealProgramPhase } from "@/domains/trainermealprogram/types";
import type { Recipe } from "@/domains/recipes/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export default async function TrainerMealProgramBuilderPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const program = await getMealProgramWithPhases(programId);
  if (!program) notFound();

  const [hydratedPhases, recipes] = await Promise.all([
    Promise.all(program.phases.map((phase) => getPhaseHydrated(phase.id))),
    getRecipesForTrainer(),
  ]);
  const recipesById = new Map(recipes.map((r) => [r.id, r]));

  return (
    <div className="space-y-6">
      <Link href="/trainer/meal-programs" className="text-sm text-neutral-500 hover:underline">
        ← Your nutrition programs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <ProgramDetailsEditor programId={program.id} name={program.name} description={program.description} />
        <ProgramStatusActions programId={program.id} status={program.status} />
      </div>

      {program.status === "draft" ? (
        <p className="text-xs text-neutral-500">
          Draft — not assignable to clients yet. Publish once it&apos;s ready.
        </p>
      ) : null}

      <div className="space-y-4">
        {hydratedPhases.map((phase, i) =>
          phase ? (
            <PhaseCard key={phase.id} phase={phase} phaseNumber={i + 1} recipes={recipes} recipesById={recipesById} />
          ) : null
        )}
        <AddPhaseForm programId={program.id} />
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
  phaseNumber,
  recipes,
  recipesById,
}: {
  phase: HydratedTrainerMealProgramPhase;
  phaseNumber: number;
  recipes: Recipe[];
  recipesById: Map<string, Recipe>;
}) {
  const mealsByDay = new Map<number, typeof phase.meals>();
  for (const meal of phase.meals) {
    const arr = mealsByDay.get(meal.dayOfWeek) ?? [];
    arr.push(meal);
    mealsByDay.set(meal.dayOfWeek, arr);
  }
  const daysWithMeals = Array.from(mealsByDay.keys()).sort((a, b) => a - b);

  return (
    <Card>
      <PhaseHeader phase={phase} phaseNumber={phaseNumber} />

      <div className="space-y-3">
        {daysWithMeals.map((dayOfWeek) => {
          const dayMeals = (mealsByDay.get(dayOfWeek) ?? [])
            .slice()
            .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType) || a.mealOrder - b.mealOrder);
          return (
            <div key={dayOfWeek} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="mb-2 text-sm font-medium">{DAY_NAMES[dayOfWeek]}</p>
              <ul className="space-y-2">
                {dayMeals.map((meal) => {
                  const recipe = recipesById.get(meal.recipeId);
                  return (
                    <MealRow
                      key={meal.id}
                      meal={meal}
                      recipes={recipes}
                      recipeName={recipe?.name ?? "—"}
                      recipeMacros={
                        recipe
                          ? `${meal.mealType} · ${recipe.calories} cal · ${recipe.proteinG}g protein`
                          : meal.mealType
                      }
                    />
                  );
                })}
              </ul>
              <div className="mt-2">
                <AddMealForm phaseId={phase.id} defaultDayOfWeek={dayOfWeek} recipes={recipes} />
              </div>
            </div>
          );
        })}
        <AddMealForm phaseId={phase.id} recipes={recipes} />
      </div>
    </Card>
  );
}
