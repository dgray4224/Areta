"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  recipeScalarSchema,
  RECIPE_CUISINES,
  RECIPE_ALLERGENS,
  type RecipeScalarInput,
  type RecipeInput,
} from "@/domains/recipes/schema";
import { createRecipe, updateRecipe } from "@/domains/recipes/service";
import { csvToArray } from "@/domains/expertregistry/schema";
import { FormField, TextInput, SelectInput, TextArea, optionalNumberValue } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Ingredient } from "@/domains/recipes/types";

function csvDefault(values: string[] | undefined): string {
  return values?.join(", ") ?? "";
}

const BLANK_INGREDIENT: Ingredient = { name: "", quantity: 0, unit: "", section: "" };

/** A plain `<img>`, not `next/image` -- this field is a free-text URL an
 * admin can paste anything into (not just the recipe-photos bucket
 * next.config.ts allowlists), and next/image throws for any host not on
 * that allowlist. A small unoptimized admin-only preview thumbnail isn't
 * worth widening the allowlist to arbitrary hosts for. */
function PhotoPreview({ url }: { url: string | undefined }) {
  if (!url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400 dark:border-neutral-700">
        No photo
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-16 w-16 shrink-0 rounded-lg border border-neutral-300 object-cover dark:border-neutral-700"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

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

const ALLERGEN_LABEL: Record<(typeof RECIPE_ALLERGENS)[number], string> = {
  milk: "Milk",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  tree_nuts: "Tree nuts",
  peanuts: "Peanuts",
  wheat: "Wheat",
  soybeans: "Soybeans",
  sesame: "Sesame",
};

export function RecipeForm({
  mode,
  recipeId,
  defaultValues,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  defaultValues?: Partial<RecipeInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [ingredients, setIngredients] = useState<Ingredient[]>(
    defaultValues?.ingredients && defaultValues.ingredients.length > 0
      ? defaultValues.ingredients
      : [{ ...BLANK_INGREDIENT }]
  );
  const [instructions, setInstructions] = useState<string[]>(
    defaultValues?.instructions && defaultValues.instructions.length > 0 ? defaultValues.instructions : [""]
  );
  const [rowError, setRowError] = useState<string | null>(null);

  const scalarDefaultValues: Partial<RecipeScalarInput> = {
    name: defaultValues?.name,
    mealType: defaultValues?.mealType,
    cuisine: defaultValues?.cuisine,
    calories: defaultValues?.calories,
    proteinG: defaultValues?.proteinG,
    carbsG: defaultValues?.carbsG,
    fatG: defaultValues?.fatG,
    fiberG: defaultValues?.fiberG,
    prepMinutes: defaultValues?.prepMinutes,
    cookMinutes: defaultValues?.cookMinutes,
    servings: defaultValues?.servings,
    allergens: defaultValues?.allergens,
    storageInstructions: defaultValues?.storageInstructions,
    photoUrl: defaultValues?.photoUrl,
    status: defaultValues?.status,
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RecipeScalarInput>({
    resolver: zodResolver(recipeScalarSchema),
    defaultValues: {
      mealType: "breakfast",
      cuisine: "american",
      status: "review",
      servings: 1,
      prepMinutes: 0,
      cookMinutes: 0,
      allergens: [],
      ...scalarDefaultValues,
    },
  });

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onSubmit(scalarValues: RecipeScalarInput) {
    setServerError(null);
    setRowError(null);
    setSaved(false);

    const cleanIngredients = ingredients.filter((row) => row.name.trim() !== "");
    const cleanInstructions = instructions.map((s) => s.trim()).filter(Boolean);
    if (cleanIngredients.length === 0) {
      setRowError("Add at least one ingredient.");
      return;
    }
    if (cleanInstructions.length === 0) {
      setRowError("Add at least one instruction step.");
      return;
    }

    const fullInput: RecipeInput = {
      ...scalarValues,
      ingredients: cleanIngredients,
      instructions: cleanInstructions,
    };

    startTransition(async () => {
      if (mode === "create") {
        const result = await createRecipe(fullInput);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        router.push(`/admin/content/recipes/${result.data.id}`);
      } else {
        const result = await updateRecipe(recipeId!, fullInput);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        setSaved(true);
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Name" htmlFor="name" error={errors.name?.message}>
          <TextInput id="name" {...register("name")} />
        </FormField>
        <FormField label="Meal type" htmlFor="mealType" error={errors.mealType?.message}>
          <SelectInput id="mealType" {...register("mealType")}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </SelectInput>
        </FormField>
        <FormField label="Cuisine" htmlFor="cuisine" error={errors.cuisine?.message}>
          <SelectInput id="cuisine" {...register("cuisine")}>
            {RECIPE_CUISINES.map((c) => (
              <option key={c} value={c}>
                {CUISINE_LABEL[c]}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <FormField label="Calories" htmlFor="calories" error={errors.calories?.message}>
          <TextInput id="calories" type="number" {...register("calories", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Protein (g)" htmlFor="proteinG" error={errors.proteinG?.message}>
          <TextInput id="proteinG" type="number" {...register("proteinG", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Carbs (g)" htmlFor="carbsG" error={errors.carbsG?.message}>
          <TextInput id="carbsG" type="number" {...register("carbsG", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Fat (g)" htmlFor="fatG" error={errors.fatG?.message}>
          <TextInput id="fatG" type="number" {...register("fatG", { valueAsNumber: true })} />
        </FormField>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <FormField label="Fiber (g)" htmlFor="fiberG" error={errors.fiberG?.message} hint="Optional">
          <TextInput
            id="fiberG"
            type="number"
            {...register("fiberG", { setValueAs: optionalNumberValue })}
          />
        </FormField>
        <FormField label="Prep minutes" htmlFor="prepMinutes" error={errors.prepMinutes?.message}>
          <TextInput id="prepMinutes" type="number" {...register("prepMinutes", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Cook minutes" htmlFor="cookMinutes" error={errors.cookMinutes?.message}>
          <TextInput id="cookMinutes" type="number" {...register("cookMinutes", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Servings" htmlFor="servings" error={errors.servings?.message}>
          <TextInput id="servings" type="number" {...register("servings", { valueAsNumber: true })} />
        </FormField>
      </div>

      <FormField
        label="Dietary tags"
        htmlFor="dietaryTags"
        error={errors.dietaryTags?.message}
        hint="Comma-separated, e.g. vegetarian, gluten-free"
      >
        <TextInput
          id="dietaryTags"
          defaultValue={csvDefault(defaultValues?.dietaryTags)}
          {...register("dietaryTags", { setValueAs: csvToArray })}
        />
      </FormField>

      <FormField
        label="Allergens"
        htmlFor="allergens"
        error={errors.allergens?.message}
        hint="Check every Big-9 allergen this recipe's ingredients actually contain."
      >
        <div className="grid grid-cols-3 gap-2">
          {RECIPE_ALLERGENS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={a} {...register("allergens")} />
              {ALLERGEN_LABEL[a]}
            </label>
          ))}
        </div>
      </FormField>

      {/* Ingredients — plain component state, not react-hook-form-managed;
       * see the comment on recipeScalarSchema for why. */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Ingredients</p>
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
              placeholder="Section"
              value={row.section}
              onChange={(e) => updateIngredient(index, { section: e.target.value })}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIngredients((rows) => rows.filter((_, i) => i !== index))}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIngredients((rows) => [...rows, { ...BLANK_INGREDIENT }])}
        >
          + Add ingredient
        </Button>
      </div>

      {/* Instructions — same plain-state approach. */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Instructions</p>
        {instructions.map((step, index) => (
          <div key={index} className="flex gap-2">
            <span className="pt-2 text-sm text-neutral-500">{index + 1}.</span>
            <div className="flex-1">
              <TextArea
                rows={2}
                value={step}
                onChange={(e) =>
                  setInstructions((rows) => rows.map((r, i) => (i === index ? e.target.value : r)))
                }
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setInstructions((rows) => rows.filter((_, i) => i !== index))}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setInstructions((rows) => [...rows, ""])}>
          + Add step
        </Button>
      </div>

      <FormField
        label="Storage instructions"
        htmlFor="storageInstructions"
        error={errors.storageInstructions?.message}
        hint="Optional"
      >
        <TextArea id="storageInstructions" {...register("storageInstructions")} rows={2} />
      </FormField>

      <FormField
        label="Photo URL"
        htmlFor="photoUrl"
        error={errors.photoUrl?.message}
        hint="Populated by pnpm run backfill:recipe-photos; edit here to override a specific recipe."
      >
        <div className="flex items-center gap-3">
          <TextInput id="photoUrl" {...register("photoUrl")} />
          <PhotoPreview url={watch("photoUrl")} />
        </div>
      </FormField>

      <FormField
        label="Status"
        htmlFor="status"
        error={errors.status?.message}
        hint={
          mode === "create"
            ? "New recipes default to \"review\" — meal-plan generation only pulls \"active\" recipes."
            : undefined
        }
      >
        <SelectInput id="status" {...register("status")}>
          <option value="review">Review</option>
          <option value="active">Active</option>
          <option value="deprecated">Deprecated</option>
        </SelectInput>
      </FormField>

      {rowError ? <p className="text-sm text-red-600">{rowError}</p> : null}
      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : mode === "create" ? "Create recipe" : "Save changes"}
      </Button>
    </form>
  );
}
