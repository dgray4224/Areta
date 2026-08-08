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
import { Button } from "@/platform/ui/Button";

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
  const timezoneOptions = getTimezoneOptions();
  const storedTimezoneIsUnrecognized =
    !!defaultValues.timeZone && !timezoneOptions.some((tz) => tz.value === defaultValues.timeZone);

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
      router.push("/onboarding");
    });
  };

  return (
    <StepShell
      title="You and your schedule"
      description="The basics Areta needs to plan around your life."
      currentStep={stepIndex}
      totalSteps={totalSteps}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Preferred Name" htmlFor="fullName" error={errors.fullName?.message}>
          <TextInput id="fullName" {...register("fullName")} />
        </FormField>

        <FormField
          label="Time zone"
          htmlFor="timeZone"
          error={errors.timeZone?.message}
          hint={
            storedTimezoneIsUnrecognized
              ? `"${defaultValues.timeZone}" isn't a real time zone — pick your actual one below`
              : undefined
          }
        >
          <SelectInput id="timeZone" {...register("timeZone")}>
            <option value="">—</option>
            {storedTimezoneIsUnrecognized ? (
              <option value={defaultValues.timeZone}>
                ⚠ {defaultValues.timeZone} (not recognized)
              </option>
            ) : null}
            {timezoneOptions.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
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

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <Button type="submit" variant="primary" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : "Continue"}
        </Button>
      </form>
    </StepShell>
  );
}
