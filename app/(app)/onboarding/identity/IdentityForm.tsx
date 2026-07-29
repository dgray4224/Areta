"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { identitySchema, WEEKDAYS, type IdentityInput } from "@/domains/identity/schema";
import { saveIdentityStep } from "@/domains/identity/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, SelectInput } from "@/platform/ui/FormField";
import { detectTimezone, getTimezoneOptions } from "@/platform/ui/timezones";

export function IdentityForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
}: {
  userId: string;
  defaultValues: Partial<IdentityInput>;
  stepIndex: number;
  totalSteps: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<IdentityInput>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      units: "imperial",
      weeklyReviewDay: 0,
      groceryDay: 6,
      mealPrepDay: 0,
      learningTimeMinutesPerWeek: 180,
      ...defaultValues,
    },
  });

  // Auto-fill from the browser rather than asking — but only after mount,
  // so server and client render the same (empty) initial select and
  // hydration doesn't try to reconcile a value the server couldn't know.
  useEffect(() => {
    if (!getValues("timeZone")) {
      setValue("timeZone", detectTimezone(), { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (values: IdentityInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveIdentityStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding/goals");
    });
  };

  return (
    <StepShell
      title="You and your schedule"
      description="The basics LifeOS needs to plan around your life."
      currentStep={stepIndex}
      totalSteps={totalSteps}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Name" htmlFor="fullName" error={errors.fullName?.message}>
          <TextInput id="fullName" {...register("fullName")} />
        </FormField>

        <FormField label="Time zone" htmlFor="timeZone" error={errors.timeZone?.message}>
          <SelectInput id="timeZone" {...register("timeZone")}>
            <option value="">—</option>
            {getTimezoneOptions().map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Units" htmlFor="units" error={errors.units?.message}>
          <SelectInput id="units" {...register("units")}>
            <option value="imperial">Imperial (lb, ft/in)</option>
            <option value="metric">Metric (kg, cm)</option>
          </SelectInput>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Typical wake time" htmlFor="wakeTime" error={errors.wakeTime?.message}>
            <TextInput id="wakeTime" type="time" {...register("wakeTime")} />
          </FormField>
          <FormField label="Typical bedtime" htmlFor="bedTime" error={errors.bedTime?.message}>
            <TextInput id="bedTime" type="time" {...register("bedTime")} />
          </FormField>
        </div>

        <FormField
          label="Work status"
          htmlFor="workStatus"
          error={errors.workStatus?.message}
          hint="e.g. Remote full-time, on leave, part-time"
        >
          <TextInput id="workStatus" {...register("workStatus")} />
        </FormField>

        <FormField
          label="Specific work hours or blocked time (optional)"
          htmlFor="workHoursNote"
          hint="e.g. 9am-5pm ET weekdays, standing meetings until 6 on Tuesdays — anything LifeOS should plan around, not a weekly total"
        >
          <TextInput id="workHoursNote" {...register("workHoursNote")} />
        </FormField>

        <FormField
          label="Class schedule or deadlines (optional)"
          htmlFor="schoolCommitments"
          hint="e.g. Tuesday/Thursday evening classes, exams the second week of October"
        >
          <TextInput id="schoolCommitments" {...register("schoolCommitments")} />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Weekly review day"
            htmlFor="weeklyReviewDay"
            error={errors.weeklyReviewDay?.message}
          >
            <SelectInput id="weeklyReviewDay" {...register("weeklyReviewDay", { valueAsNumber: true })}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Grocery day" htmlFor="groceryDay" error={errors.groceryDay?.message}>
            <SelectInput id="groceryDay" {...register("groceryDay", { valueAsNumber: true })}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Meal-prep day" htmlFor="mealPrepDay" error={errors.mealPrepDay?.message}>
            <SelectInput id="mealPrepDay" {...register("mealPrepDay", { valueAsNumber: true })}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <FormField
          label="Available learning time (minutes/week)"
          htmlFor="learningTimeMinutesPerWeek"
          error={errors.learningTimeMinutesPerWeek?.message}
        >
          <TextInput
            id="learningTimeMinutesPerWeek"
            type="number"
            min={0}
            {...register("learningTimeMinutesPerWeek", { valueAsNumber: true })}
          />
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
