"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { identitySchema, WEEKDAYS, type IdentityInput } from "@/domains/identity/schema";
import { updateProfile } from "@/domains/identity/service";
import { FormField, TextInput, SelectInput } from "@/platform/ui/FormField";
import { detectTimezone, getTimezoneOptions } from "@/platform/ui/timezones";

export function ProfileForm({
  userId,
  defaultValues,
}: {
  userId: string;
  defaultValues: Partial<IdentityInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<IdentityInput>({
    resolver: zodResolver(identitySchema),
    defaultValues,
  });

  useEffect(() => {
    if (!getValues("timeZone")) {
      setValue("timeZone", detectTimezone(), { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (values: IdentityInput) => {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
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
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
