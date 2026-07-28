"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sleepLogSchema, type SleepLogInput } from "@/domains/sleep/schema";
import { logSleep } from "@/domains/sleep/service";
import { FormField, TextInput, SelectInput, optionalNumberValue } from "@/platform/ui/FormField";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SleepLogForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SleepLogInput>({
    resolver: zodResolver(sleepLogSchema),
    defaultValues: { date: todayDateString() },
  });

  const onSubmit = (values: SleepLogInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await logSleep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Log sleep</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Date" htmlFor="date" error={errors.date?.message}>
          <TextInput id="date" type="date" autoFocus {...register("date")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Bedtime" htmlFor="bedtime">
            <TextInput id="bedtime" type="datetime-local" {...register("bedtime")} />
          </FormField>
          <FormField label="Wake time" htmlFor="wakeTime">
            <TextInput id="wakeTime" type="datetime-local" {...register("wakeTime")} />
          </FormField>
        </div>
        <FormField
          label="Total duration (minutes, optional)"
          htmlFor="totalDurationMinutes"
          hint="Leave blank to calculate from bedtime/wake time"
        >
          <TextInput
            id="totalDurationMinutes"
            type="number"
            min={0}
            {...register("totalDurationMinutes", { setValueAs: optionalNumberValue })}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quality (1-5)" htmlFor="quality">
            <SelectInput id="quality" {...register("quality", { setValueAs: optionalNumberValue })}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Interruptions" htmlFor="interruptions">
            <TextInput
              id="interruptions"
              type="number"
              min={0}
              {...register("interruptions", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>
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
