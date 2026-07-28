"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { nutritionLogSchema, type NutritionLogInput } from "@/domains/nutrition/log-schema";
import { logNutrition } from "@/domains/nutrition/log-service";
import { FormField, TextInput, SelectInput, optionalNumberValue } from "@/platform/ui/FormField";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NutritionLogForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NutritionLogInput>({
    resolver: zodResolver(nutritionLogSchema),
    defaultValues: { date: todayDateString(), meal: "breakfast" },
  });

  const onSubmit = (values: NutritionLogInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await logNutrition(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Log food</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date" htmlFor="date" error={errors.date?.message}>
            <TextInput id="date" type="date" {...register("date")} />
          </FormField>
          <FormField label="Meal" htmlFor="meal" error={errors.meal?.message}>
            <SelectInput id="meal" {...register("meal")}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </SelectInput>
          </FormField>
        </div>
        <FormField label="Food" htmlFor="food" error={errors.food?.message}>
          <TextInput id="food" autoFocus {...register("food")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quantity" htmlFor="quantity">
            <TextInput
              id="quantity"
              type="number"
              step="0.1"
              {...register("quantity", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Unit" htmlFor="unit">
            <TextInput id="unit" placeholder="g, oz, cup…" {...register("unit")} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Calories" htmlFor="calories">
            <TextInput
              id="calories"
              type="number"
              {...register("calories", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Protein (g)" htmlFor="protein">
            <TextInput
              id="protein"
              type="number"
              step="0.1"
              {...register("protein", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Carbs (g)" htmlFor="carbohydrates">
            <TextInput
              id="carbohydrates"
              type="number"
              step="0.1"
              {...register("carbohydrates", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Fat (g)" htmlFor="fat">
            <TextInput
              id="fat"
              type="number"
              step="0.1"
              {...register("fat", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>
        <FormField label="Fiber (g)" htmlFor="fiber">
          <TextInput
            id="fiber"
            type="number"
            step="0.1"
            {...register("fiber", { setValueAs: optionalNumberValue })}
          />
        </FormField>
        <FormField label="Notes (optional)" htmlFor="notes">
          <TextInput id="notes" {...register("notes")} />
        </FormField>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
