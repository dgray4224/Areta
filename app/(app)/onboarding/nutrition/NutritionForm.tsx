"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ACTIVITY_LEVELS,
  nutritionSchema,
  type NutritionInput,
  FOOD_PREFERENCE_SUGGESTIONS,
  ALLERGY_SUGGESTIONS,
  DISLIKED_FOOD_SUGGESTIONS,
  FAVORITE_MEAL_SUGGESTIONS,
  GROCERY_STORE_SUGGESTIONS,
  APPLIANCE_SUGGESTIONS,
} from "@/domains/nutrition/schema";
import { saveNutritionStep } from "@/domains/nutrition/service";
import { StepShell } from "@/platform/ui/StepShell";
import {
  FormField,
  TextInput,
  SelectInput,
  optionalNumberValue,
  optionalStringValue,
} from "@/platform/ui/FormField";
import { TagPicker } from "@/platform/ui/TagPicker";

export function NutritionForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
  backHref,
}: {
  userId: string;
  defaultValues: Partial<NutritionInput>;
  stepIndex: number;
  totalSteps: number;
  backHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
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
      router.push("/onboarding");
    });
  };

  return (
    <StepShell
      title="Food and nutrition"
      description="Preferences only — Areta derives calorie and protein targets later, not you."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Height"
            htmlFor="height"
            error={errors.height?.message}
            hint="Inches if imperial, cm if metric"
          >
            <TextInput
              id="height"
              type="number"
              step="0.1"
              {...register("height", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField
            label="Current weight"
            htmlFor="currentWeight"
            error={errors.currentWeight?.message}
            hint="lb if imperial, kg if metric"
          >
            <TextInput
              id="currentWeight"
              type="number"
              step="0.1"
              {...register("currentWeight", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField
            label="Target weight"
            htmlFor="targetWeight"
            error={errors.targetWeight?.message}
            hint="Same units as above"
          >
            <TextInput
              id="targetWeight"
              type="number"
              step="0.1"
              {...register("targetWeight", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Age" htmlFor="age" error={errors.age?.message}>
            <TextInput
              id="age"
              type="number"
              {...register("age", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Sex (optional)" htmlFor="sex" error={errors.sex?.message}>
            <SelectInput id="sex" {...register("sex", { setValueAs: optionalStringValue })}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </SelectInput>
          </FormField>
          <FormField
            label="Typical activity"
            htmlFor="activityLevel"
            error={errors.activityLevel?.message}
          >
            <SelectInput
              id="activityLevel"
              {...register("activityLevel", { setValueAs: optionalStringValue })}
            >
              <option value="">—</option>
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.replace("_", " ")}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <FormField label="Food preferences" htmlFor="foodPreferences">
          <Controller
            name="foodPreferences"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="foodPreferences"
                suggestions={FOOD_PREFERENCE_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField label="Allergies" htmlFor="allergies">
          <Controller
            name="allergies"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="allergies"
                suggestions={ALLERGY_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField label="Disliked foods" htmlFor="dislikedFoods">
          <Controller
            name="dislikedFoods"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="dislikedFoods"
                suggestions={DISLIKED_FOOD_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField label="Favorite meals" htmlFor="favoriteMeals">
          <Controller
            name="favoriteMeals"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="favoriteMeals"
                suggestions={FAVORITE_MEAL_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Prep time per week (minutes)"
            htmlFor="availablePrepTimeMinutes"
            hint="Total time for your weekly meal-prep session (e.g. Sunday), not per day"
          >
            <TextInput
              id="availablePrepTimeMinutes"
              type="number"
              min={0}
              {...register("availablePrepTimeMinutes", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField
            label="Household servings"
            htmlFor="householdServings"
            hint="How many people each meal should feed"
          >
            <TextInput
              id="householdServings"
              type="number"
              min={1}
              {...register("householdServings", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>

        <FormField label="Grocery store(s)" htmlFor="groceryStores">
          <Controller
            name="groceryStores"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="groceryStores"
                suggestions={GROCERY_STORE_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField
          label="Weekly grocery budget"
          htmlFor="budget"
          hint="Roughly how much you want to spend on groceries per week"
        >
          <TextInput id="budget" {...register("budget")} />
        </FormField>
        <FormField label="Appliances available" htmlFor="appliances">
          <Controller
            name="appliances"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="appliances"
                suggestions={APPLIANCE_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Meal-logging detail"
            htmlFor="trackingPreference"
            error={errors.trackingPreference?.message}
            hint="How much detail you want to enter when logging a meal later"
          >
            <SelectInput
              id="trackingPreference"
              {...register("trackingPreference", { setValueAs: optionalStringValue })}
            >
              <option value="">—</option>
              <option value="detailed">Detailed — full calories, protein, carbs, fat, fiber</option>
              <option value="simple">Simple — quick estimate only</option>
              <option value="none">None — skip nutrition logging</option>
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
