"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { nutritionSchema, type NutritionInput } from "@/domains/nutrition/schema";
import { saveNutritionStep } from "@/domains/nutrition/service";
import { StepShell } from "@/platform/ui/StepShell";
import {
  FormField,
  TextInput,
  SelectInput,
  optionalNumberValue,
  optionalStringValue,
} from "@/platform/ui/FormField";

export function NutritionForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
}: {
  userId: string;
  defaultValues: Partial<NutritionInput>;
  stepIndex: number;
  totalSteps: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NutritionInput>({
    resolver: zodResolver(nutritionSchema),
    defaultValues,
  });

  const onSubmit = (values: NutritionInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveNutritionStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding/recovery");
    });
  };

  return (
    <StepShell
      title="Food and nutrition"
      description="Preferences only — LifeOS derives calorie and protein targets later, not you."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref="/onboarding/goals"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Height" htmlFor="height" error={errors.height?.message}>
            <TextInput
              id="height"
              type="number"
              step="0.1"
              {...register("height", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Current weight" htmlFor="currentWeight" error={errors.currentWeight?.message}>
            <TextInput
              id="currentWeight"
              type="number"
              step="0.1"
              {...register("currentWeight", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Target weight" htmlFor="targetWeight" error={errors.targetWeight?.message}>
            <TextInput
              id="targetWeight"
              type="number"
              step="0.1"
              {...register("targetWeight", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>

        <FormField label="Food preferences" htmlFor="foodPreferences">
          <TextInput id="foodPreferences" {...register("foodPreferences")} />
        </FormField>
        <FormField label="Allergies" htmlFor="allergies">
          <TextInput id="allergies" {...register("allergies")} />
        </FormField>
        <FormField label="Disliked foods" htmlFor="dislikedFoods">
          <TextInput id="dislikedFoods" {...register("dislikedFoods")} />
        </FormField>
        <FormField label="Favorite meals" htmlFor="favoriteMeals">
          <TextInput id="favoriteMeals" {...register("favoriteMeals")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Meals per day" htmlFor="mealsPerDay" error={errors.mealsPerDay?.message}>
            <TextInput
              id="mealsPerDay"
              type="number"
              min={1}
              max={10}
              {...register("mealsPerDay", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Cooking ability" htmlFor="cookingAbility" error={errors.cookingAbility?.message}>
            <SelectInput
              id="cookingAbility"
              {...register("cookingAbility", { setValueAs: optionalStringValue })}
            >
              <option value="">—</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </SelectInput>
          </FormField>
        </div>

        <FormField label="Grocery store(s)" htmlFor="groceryStores">
          <TextInput id="groceryStores" {...register("groceryStores")} />
        </FormField>
        <FormField label="Budget" htmlFor="budget">
          <TextInput id="budget" {...register("budget")} />
        </FormField>
        <FormField label="Appliances available" htmlFor="appliances">
          <TextInput id="appliances" {...register("appliances")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Tracking preference"
            htmlFor="trackingPreference"
            error={errors.trackingPreference?.message}
          >
            <SelectInput
              id="trackingPreference"
              {...register("trackingPreference", { setValueAs: optionalStringValue })}
            >
              <option value="">—</option>
              <option value="detailed">Detailed</option>
              <option value="simple">Simple</option>
              <option value="none">None</option>
            </SelectInput>
          </FormField>
          <FormField label="Protein target (g), if known" htmlFor="proteinTargetGrams">
            <TextInput
              id="proteinTargetGrams"
              type="number"
              {...register("proteinTargetGrams", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isPending ? "Saving…" : "Continue"}
        </button>
      </form>
    </StepShell>
  );
}
