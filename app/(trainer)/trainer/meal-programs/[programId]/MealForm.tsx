"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMeal, updateMeal, deleteMeal } from "@/domains/trainermealprogram/service";
import { SelectInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import { RecipeSearchField } from "../../RecipePicker";
import type { Recipe } from "@/domains/recipes/types";
import type { MealType, TrainerMealProgramMeal } from "@/domains/trainermealprogram/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Combined day + meal-type + recipe picker -- the nutrition side has no
 * separate "add session day" step the way workouts do (AddSessionForm),
 * since a meal slot is already fully identified by (dayOfWeek,
 * mealType); see domains/trainermealprogram/types.ts's own comment. */
export function AddMealForm({
  phaseId,
  defaultDayOfWeek,
  recipes,
}: {
  phaseId: string;
  defaultDayOfWeek?: number;
  recipes: Recipe[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(defaultDayOfWeek ?? 0);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [recipeId, setRecipeId] = useState("");
  const [recipeList, setRecipeList] = useState(recipes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        + Add meal
      </button>
    );
  }

  const onSave = () => {
    if (!recipeId) {
      setError("Pick a recipe.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addMeal(phaseId, { dayOfWeek, mealType, recipeId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setRecipeId("");
      router.refresh();
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="grid grid-cols-2 gap-2">
        <SelectInput
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value))}
          aria-label="Day of week"
        >
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={mealType}
          onChange={(e) => {
            setMealType(e.target.value as MealType);
            setRecipeId("");
          }}
          aria-label="Meal type"
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEAL_TYPE_LABEL[t]}
            </option>
          ))}
        </SelectInput>
      </div>
      <RecipeSearchField
        recipeId={recipeId}
        onSelect={setRecipeId}
        recipes={recipeList}
        mealType={mealType}
        onRecipeCreated={(r) => setRecipeList((prev) => [...prev, r])}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Add"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MealRow({
  meal,
  recipes,
  recipeName,
  recipeMacros,
}: {
  meal: TrainerMealProgramMeal;
  recipes: Recipe[];
  recipeName: string;
  recipeMacros: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(meal.dayOfWeek);
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  const [recipeId, setRecipeId] = useState(meal.recipeId);
  const [recipeList, setRecipeList] = useState(recipes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    if (!recipeId) {
      setError("Pick a recipe.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateMeal(meal.id, { dayOfWeek, mealType, recipeId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm("Remove this meal from the program?")) return;
    startTransition(async () => {
      const result = await deleteMeal(meal.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <li className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
        <span>
          {recipeName} <span className="text-xs text-neutral-500">— {recipeMacros}</span>
        </span>
        <span className="flex gap-2 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="hover:underline">
            Edit
          </button>
          <button type="button" onClick={onDelete} disabled={isPending} className="text-red-600 hover:underline">
            Remove
          </button>
        </span>
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="grid grid-cols-2 gap-2">
        <SelectInput
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value))}
          aria-label="Day of week"
        >
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={mealType}
          onChange={(e) => {
            setMealType(e.target.value as MealType);
            setRecipeId("");
          }}
          aria-label="Meal type"
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEAL_TYPE_LABEL[t]}
            </option>
          ))}
        </SelectInput>
      </div>
      <RecipeSearchField
        recipeId={recipeId}
        onSelect={setRecipeId}
        recipes={recipeList}
        mealType={mealType}
        onRecipeCreated={(r) => setRecipeList((prev) => [...prev, r])}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </li>
  );
}
