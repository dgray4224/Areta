"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  sleepGoalsSchema,
  type SleepGoalsInput,
  SLEEP_DISRUPTOR_SUGGESTIONS,
} from "@/domains/sleep/schema";
import { saveSleepGoalsStep } from "@/domains/sleep/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, TextArea, optionalNumberValue } from "@/platform/ui/FormField";
import { TagPicker } from "@/platform/ui/TagPicker";

export function SleepForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
  backHref,
}: {
  userId: string;
  defaultValues: Partial<SleepGoalsInput>;
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
  } = useForm<SleepGoalsInput>({
    resolver: zodResolver(sleepGoalsSchema),
    defaultValues,
  });

  const onSubmit = (values: SleepGoalsInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveSleepGoalsStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding");
    });
  };

  return (
    <StepShell
      title="Sleep"
      description="What are you aiming for, and what tends to get in the way?"
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Target bedtime" htmlFor="targetBedtime">
            <TextInput id="targetBedtime" type="time" {...register("targetBedtime")} />
          </FormField>
          <FormField label="Target wake time" htmlFor="targetWakeTime">
            <TextInput id="targetWakeTime" type="time" {...register("targetWakeTime")} />
          </FormField>
        </div>

        <FormField label="Target duration (hours)" htmlFor="targetDurationHours">
          <TextInput
            id="targetDurationHours"
            type="number"
            step="0.5"
            min={0}
            {...register("targetDurationHours", { setValueAs: optionalNumberValue })}
          />
        </FormField>

        <FormField
          label="What tends to disrupt your sleep?"
          htmlFor="disruptors"
          error={errors.disruptors?.message}
        >
          <Controller
            name="disruptors"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="disruptors"
                suggestions={SLEEP_DISRUPTOR_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <FormField label="Notes (optional)" htmlFor="notes">
          <TextArea id="notes" {...register("notes")} />
        </FormField>

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
