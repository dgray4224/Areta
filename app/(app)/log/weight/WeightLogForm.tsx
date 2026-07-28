"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { weightLogSchema, type WeightLogInput } from "@/domains/weight/schema";
import { logWeight } from "@/domains/weight/service";
import { FormField, TextInput, SelectInput, optionalNumberValue } from "@/platform/ui/FormField";

function nowLocalDatetime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function WeightLogForm({
  userId,
  defaultUnit,
}: {
  userId: string;
  defaultUnit: "lb" | "kg";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WeightLogInput>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: { loggedAt: nowLocalDatetime(), unit: defaultUnit },
  });

  const onSubmit = (values: WeightLogInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await logWeight(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Log weight</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Weight" htmlFor="weight" error={errors.weight?.message}>
          <TextInput
            id="weight"
            type="number"
            step="0.1"
            autoFocus
            {...register("weight", { setValueAs: optionalNumberValue })}
          />
        </FormField>
        <FormField label="Unit" htmlFor="unit" error={errors.unit?.message}>
          <SelectInput id="unit" {...register("unit")}>
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </SelectInput>
        </FormField>
        <FormField label="When" htmlFor="loggedAt" error={errors.loggedAt?.message}>
          <TextInput id="loggedAt" type="datetime-local" {...register("loggedAt")} />
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
