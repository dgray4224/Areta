"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createRecipeAsTrainer } from "@/domains/trainermealprogram/service";
import { FormField, TextInput, SelectInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Recipe, Ingredient } from "@/domains/recipes/types";
import { RECIPE_CUISINES, RECIPE_DISH_TYPES, RECIPE_MEAL_TYPES } from "@/domains/recipes/schema";
import { DISH_TYPE_LABELS } from "@/domains/recipes/labels";
import type { MealType } from "@/domains/trainermealprogram/types";

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const CUISINE_LABEL: Record<(typeof RECIPE_CUISINES)[number], string> = {
  american: "American",
  italian: "Italian",
  mexican: "Mexican",
  chinese: "Chinese",
  japanese: "Japanese",
  thai: "Thai",
  indian: "Indian",
  mediterranean: "Mediterranean",
};

/**
 * Search-only recipe combobox, scoped to one meal type -- unlike
 * ExercisePicker's browse-by-muscle-group version, a recipe slot's meal
 * type is already chosen before this renders (the day/meal-type picker
 * in the parent form), so there's no second dimension worth browsing by
 * here; a flat filtered search is enough for a shared library this size.
 * Same composedPath()-based outside-click handling as
 * ExerciseSearchField (see that file's own comment for why a plain
 * .contains() check breaks when selecting an option unmounts itself
 * mid-click) and the same "Can't find it? Add a new recipe" affordance.
 */
export function RecipeSearchField({
  recipeId,
  onSelect,
  recipes,
  mealType,
  onRecipeCreated,
}: {
  recipeId: string;
  onSelect: (recipeId: string) => void;
  recipes: Recipe[];
  mealType: MealType;
  onRecipeCreated: (r: Recipe) => void;
}) {
  const scoped = useMemo(() => recipes.filter((r) => r.mealType === mealType), [recipes, mealType]);
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [query, setQuery] = useState(() => scoped.find((r) => r.id === recipeId)?.name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const visibleRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter((r) => r.name.toLowerCase().includes(needle));
  }, [scoped, query]);

  const selectRecipe = (r: Recipe) => {
    onSelect(r.id);
    setQuery(r.name);
    setOpen(false);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    const match = scoped.find((r) => r.name.toLowerCase() === value.trim().toLowerCase());
    onSelect(match?.id ?? "");
  };

  return (
    <div className="space-y-2">
      <div className="relative" ref={containerRef}>
        <TextInput
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder={`Search ${MEAL_TYPE_LABEL[mealType].toLowerCase()} recipes…`}
          aria-label="Recipe"
          autoComplete="off"
        />
        {open ? (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-300 bg-card shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {visibleRecipes.length > 0 ? (
              visibleRecipes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectRecipe(r);
                  }}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {r.calories} cal · {r.proteinG}g protein
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-neutral-500">
                No {MEAL_TYPE_LABEL[mealType].toLowerCase()} recipes match &quot;{query}&quot;.
              </p>
            )}
          </div>
        ) : null}
      </div>
      {recipeId === "" && query !== "" ? (
        <p className="text-xs text-neutral-500">No exact match yet — pick one from the list above.</p>
      ) : null}
      {addingRecipe ? (
        <NewRecipeInline
          mealType={mealType}
          onCancel={() => setAddingRecipe(false)}
          onCreated={(r) => {
            onRecipeCreated(r);
            onSelect(r.id);
            setQuery(r.name);
            setAddingRecipe(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingRecipe(true)}
          className="text-xs text-neutral-500 hover:underline"
        >
          Can&apos;t find it? Add a new recipe
        </button>
      )}
    </div>
  );
}

const BLANK_INGREDIENT: Ingredient = { name: "", quantity: 0, unit: "", section: "" };

/** Inline "add a new recipe" mini-form -- inserts into the shared
 * recipes table with status 'review' (admin-reviewable, same pattern as
 * createRecipeAsTrainer's own doc comment), immediately usable by this
 * trainer's own clients without waiting on that review. Plain useState
 * throughout rather than react-hook-form, matching ExercisePicker's
 * NewExerciseInline -- this is a quick add-while-building affordance,
 * not the full admin RecipeForm.tsx, even though it needs the same
 * ingredients/instructions arrays that form manages as plain state too
 * (see recipeScalarSchema's own comment on why those two fields aren't
 * react-hook-form-managed anywhere in this app). */
function NewRecipeInline({
  mealType,
  onCancel,
  onCreated,
}: {
  mealType: MealType;
  onCancel: () => void;
  onCreated: (r: Recipe) => void;
}) {
  const [name, setName] = useState("");
  const [recipeMealType, setRecipeMealType] = useState<MealType>(mealType);
  const [cuisine, setCuisine] = useState<(typeof RECIPE_CUISINES)[number]>("american");
  const [dishType, setDishType] = useState<(typeof RECIPE_DISH_TYPES)[number]>("bowl");
  const [alsoSuitableFor, setAlsoSuitableFor] = useState<MealType[]>([]);
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [servings, setServings] = useState("1");
  const [prepMinutes, setPrepMinutes] = useState("0");
  const [cookMinutes, setCookMinutes] = useState("0");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ ...BLANK_INGREDIENT }]);
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const onSave = () => {
    const cleanIngredients = ingredients.filter((row) => row.name.trim() !== "");
    const cleanInstructions = instructions.map((s) => s.trim()).filter(Boolean);
    if (!name || !calories || !proteinG || !carbsG || !fatG) {
      setError("Name and all four macros are required.");
      return;
    }
    if (cleanIngredients.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    if (cleanInstructions.length === 0) {
      setError("Add at least one instruction step.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createRecipeAsTrainer({
        name,
        mealType: recipeMealType,
        cuisine,
        dishType,
        // Guard against stale state: switching the primary meal type
        // hides its checkbox but leaves any prior selection behind, and
        // the DB rejects a recipe listed as also-suitable-for itself.
        alsoSuitableFor: alsoSuitableFor.filter((m) => m !== recipeMealType),
        calories: Number(calories),
        proteinG: Number(proteinG),
        carbsG: Number(carbsG),
        fatG: Number(fatG),
        servings: Number(servings) || 1,
        prepMinutes: Number(prepMinutes) || 0,
        cookMinutes: Number(cookMinutes) || 0,
        dietaryTags: [],
        allergens: [],
        ingredients: cleanIngredients,
        instructions: cleanInstructions,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated({
        id: result.data.id,
        name,
        mealType: recipeMealType,
        cuisine,
        dishType,
        // Guard against stale state: switching the primary meal type
        // hides its checkbox but leaves any prior selection behind, and
        // the DB rejects a recipe listed as also-suitable-for itself.
        alsoSuitableFor: alsoSuitableFor.filter((m) => m !== recipeMealType),
        calories: Number(calories),
        proteinG: Number(proteinG),
        carbsG: Number(carbsG),
        fatG: Number(fatG),
        fiberG: null,
        prepMinutes: Number(prepMinutes) || 0,
        cookMinutes: Number(cookMinutes) || 0,
        servings: Number(servings) || 1,
        dietaryTags: [],
        allergens: [],
        ingredients: cleanIngredients,
        instructions: cleanInstructions,
        storageInstructions: null,
        photoUrl: null,
        status: "review",
      });
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Recipe name" htmlFor="new-recipe-name" hint="e.g. Greek yogurt bowl">
          <TextInput id="new-recipe-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Meal type" htmlFor="new-recipe-mealtype">
          <SelectInput
            id="new-recipe-mealtype"
            value={recipeMealType}
            onChange={(e) => setRecipeMealType(e.target.value as MealType)}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </SelectInput>
        </FormField>
        <FormField label="Cuisine" htmlFor="new-recipe-cuisine">
          <SelectInput
            id="new-recipe-cuisine"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value as (typeof RECIPE_CUISINES)[number])}
          >
            {RECIPE_CUISINES.map((c) => (
              <option key={c} value={c}>
                {CUISINE_LABEL[c]}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Also suitable for" htmlFor="new-recipe-also-suitable">
          {/* Crossover slots. Lunch and dinner are usually interchangeable,
              so marking them here roughly doubles the pool the planner and
              picker can draw from without writing another recipe. */}
          <div id="new-recipe-also-suitable" className="flex flex-wrap gap-3">
            {RECIPE_MEAL_TYPES.filter((m) => m !== recipeMealType).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={alsoSuitableFor.includes(m)}
                  onChange={(e) =>
                    setAlsoSuitableFor((prev) => (e.target.checked ? [...prev, m] : prev.filter((x) => x !== m)))
                  }
                />
                {m}
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Dish type" htmlFor="new-recipe-dish-type">
          <SelectInput
            id="new-recipe-dish-type"
            value={dishType}
            onChange={(e) => setDishType(e.target.value as (typeof RECIPE_DISH_TYPES)[number])}
          >
            {RECIPE_DISH_TYPES.map((d) => (
              <option key={d} value={d}>
                {DISH_TYPE_LABELS[d]}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <FormField label="Calories" htmlFor="new-recipe-cal">
          <TextInput id="new-recipe-cal" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </FormField>
        <FormField label="Protein (g)" htmlFor="new-recipe-protein">
          <TextInput id="new-recipe-protein" type="number" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
        </FormField>
        <FormField label="Carbs (g)" htmlFor="new-recipe-carbs">
          <TextInput id="new-recipe-carbs" type="number" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
        </FormField>
        <FormField label="Fat (g)" htmlFor="new-recipe-fat">
          <TextInput id="new-recipe-fat" type="number" value={fatG} onChange={(e) => setFatG(e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Servings" htmlFor="new-recipe-servings" hint="How many portions this recipe makes.">
          <TextInput id="new-recipe-servings" type="number" value={servings} onChange={(e) => setServings(e.target.value)} />
        </FormField>
        <FormField label="Prep minutes" htmlFor="new-recipe-prep">
          <TextInput id="new-recipe-prep" type="number" value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} />
        </FormField>
        <FormField label="Cook minutes" htmlFor="new-recipe-cook">
          <TextInput id="new-recipe-cook" type="number" value={cookMinutes} onChange={(e) => setCookMinutes(e.target.value)} />
        </FormField>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Ingredients
          <span className="ml-2 text-xs font-normal text-neutral-500">what goes on the grocery list</span>
        </p>
        {ingredients.map((row, index) => (
          <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2">
            <TextInput
              placeholder="Name"
              value={row.name}
              onChange={(e) => updateIngredient(index, { name: e.target.value })}
            />
            <TextInput
              type="number"
              placeholder="Qty"
              value={row.quantity || ""}
              onChange={(e) => updateIngredient(index, { quantity: Number(e.target.value) || 0 })}
            />
            <TextInput
              placeholder="Unit"
              value={row.unit}
              onChange={(e) => updateIngredient(index, { unit: e.target.value })}
            />
            <TextInput
              placeholder="Section, e.g. Produce"
              value={row.section}
              onChange={(e) => updateIngredient(index, { section: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setIngredients((rows) => rows.filter((_, i) => i !== index))}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setIngredients((rows) => [...rows, { ...BLANK_INGREDIENT }])}
          className="text-xs text-neutral-500 hover:underline"
        >
          + Add ingredient
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Instructions</p>
        {instructions.map((step, index) => (
          <div key={index} className="flex gap-2">
            <span className="pt-2 text-sm text-neutral-500">{index + 1}.</span>
            <div className="flex-1">
              <TextArea
                rows={2}
                value={step}
                onChange={(e) => setInstructions((rows) => rows.map((r, i) => (i === index ? e.target.value : r)))}
              />
            </div>
            <button
              type="button"
              onClick={() => setInstructions((rows) => rows.filter((_, i) => i !== index))}
              className="shrink-0 text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setInstructions((rows) => [...rows, ""])}
          className="text-xs text-neutral-500 hover:underline"
        >
          + Add step
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Add recipe"}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
