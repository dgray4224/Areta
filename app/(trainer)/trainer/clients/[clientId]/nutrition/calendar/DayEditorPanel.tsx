"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClientMealDateOverride, clearClientMealDateOverride } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import { SelectInput } from "@/platform/ui/FormField";
import { RecipeSearchField } from "../../../../RecipePicker";
import type { ProjectedMealDay } from "@/domains/trainermealprogram/calendar-projection";
import type { Recipe } from "@/domains/recipes/types";
import type { MealType } from "@/domains/trainermealprogram/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

type MealRow = { mealType: MealType; recipeId: string; servings: string };

/** Nutrition-side mirror of the workout calendar's DayEditorPanel.tsx --
 * see that file's own layout for the pattern this follows. One
 * structural difference: a meal row needs its own meal-type select (a
 * day can have several meals of different types), which a workout day's
 * exercise rows never needed since day-of-week alone identified the
 * session; servings is also editable per row here, since migration
 * 0085's own comment explains why an override meal carries an explicit
 * quantity rather than a recommendation. */
export function DayEditorPanel({
  clientId,
  day,
  recipes,
  onClose,
}: {
  clientId: string;
  day: ProjectedMealDay;
  recipes: Recipe[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isNoProgramDay, setIsNoProgramDay] = useState(day.meals.length === 0);
  const [rows, setRows] = useState<MealRow[]>(
    day.meals.length > 0
      ? day.meals.map((m) => ({ mealType: m.mealType, recipeId: m.recipeId, servings: String(m.servings ?? 1) }))
      : []
  );
  const [recipeList, setRecipeList] = useState(recipes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateRow = (index: number, next: Partial<MealRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
  };

  const onSave = () => {
    if (!isNoProgramDay && rows.some((r) => !r.recipeId)) {
      setError("Every meal needs a recipe picked, or remove the empty row.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setClientMealDateOverride(clientId, day.date, {
        isNoProgramDay,
        meals: isNoProgramDay
          ? []
          : rows.map((r) => ({ mealType: r.mealType, recipeId: r.recipeId, servings: Number(r.servings) || 1 })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const onResetToTemplate = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearClientMealDateOverride(clientId, day.date);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">{day.date}</p>
            <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:underline">
              Close
            </button>
          </div>

          <label
            className="mb-3 flex items-center gap-2 text-sm"
            title="No program meals scheduled this one day -- the client eats freely."
          >
            <input
              type="checkbox"
              checked={isNoProgramDay}
              onChange={(e) => {
                setIsNoProgramDay(e.target.checked);
                if (e.target.checked) setRows([]);
              }}
            />
            No program meals this day
          </label>

          {!isNoProgramDay ? (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <SelectInput
                        value={row.mealType}
                        onChange={(e) => updateRow(index, { mealType: e.target.value as MealType })}
                      >
                        {MEAL_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {MEAL_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </SelectInput>
                      <RecipeSearchField
                        recipeId={row.recipeId}
                        onSelect={(recipeId) => updateRow(index, { recipeId })}
                        recipes={recipeList}
                        mealType={row.mealType}
                        onRecipeCreated={(r) => setRecipeList((prev) => [...prev, r])}
                      />
                      <label className="block text-xs text-neutral-500">
                        Servings
                        <input
                          type="number"
                          step="0.25"
                          min="0.25"
                          value={row.servings}
                          onChange={(e) => updateRow(index, { servings: e.target.value })}
                          className="mt-1 w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, { mealType: "breakfast", recipeId: "", servings: "1" }])}
                className="text-sm text-neutral-500 hover:underline"
              >
                + Add meal
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" disabled={isPending} onClick={onSave} title="Saves changes for this day only.">
              {isPending ? "Saving…" : "Save"}
            </Button>
            {day.source === "override" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={onResetToTemplate}
                title="Undoes your changes and goes back to the normal plan for this day."
                className="text-sm text-neutral-500 hover:underline"
              >
                Reset to template
              </button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
