"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { recoveryLogSchema, type RecoveryLogInput } from "@/domains/recovery/log-schema";
import { logRecovery } from "@/domains/recovery/log-service";
import { FormField, TextInput, SelectInput, TextArea, optionalNumberValue } from "@/platform/ui/FormField";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecoveryLogForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RecoveryLogInput>({
    resolver: zodResolver(recoveryLogSchema),
    defaultValues: { date: todayDateString(), warningSigns: false },
  });

  const warningSigns = watch("warningSigns");

  const onSubmit = (values: RecoveryLogInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await logRecovery(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Log recovery</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Date" htmlFor="date" error={errors.date?.message}>
          <TextInput id="date" type="date" autoFocus {...register("date")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Pain (0-10)" htmlFor="pain">
            <SelectInput id="pain" {...register("pain", { setValueAs: optionalNumberValue })}>
              <option value="">—</option>
              {Array.from({ length: 11 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Swelling (0-10)" htmlFor="swelling">
            <SelectInput id="swelling" {...register("swelling", { setValueAs: optionalNumberValue })}>
              <option value="">—</option>
              {Array.from({ length: 11 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>
        <FormField label="Energy (1-5)" htmlFor="energy">
          <SelectInput id="energy" {...register("energy", { setValueAs: optionalNumberValue })}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("braceCompliance")} />
            Brace compliance
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("medicationAdherence")} />
            Medication taken
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("elevation")} />
            Elevation
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("ice")} />
            Ice
          </label>
        </div>

        <FormField label="Approved exercises done" htmlFor="approvedExercises">
          <TextInput id="approvedExercises" {...register("approvedExercises")} />
        </FormField>
        <FormField label="Mobility" htmlFor="mobility">
          <TextInput id="mobility" {...register("mobility")} />
        </FormField>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" {...register("warningSigns")} />
          <span>I&apos;m experiencing a warning sign my care team told me to watch for</span>
        </label>
        {warningSigns ? (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            Contact your care team or emergency services if needed. LifeOS can&apos;t assess this
            for you — use the notes field only to record what you told them.
            <FormField label="Notes for your care team" htmlFor="warningSignsNotes">
              <TextArea id="warningSignsNotes" {...register("warningSignsNotes")} />
            </FormField>
          </div>
        ) : null}

        <FormField label="Notes (optional)" htmlFor="notes">
          <TextArea id="notes" {...register("notes")} />
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
