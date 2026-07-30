"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  exerciseLogSchema,
  type ExerciseLogInput,
  EXERCISE_ARCHETYPES,
  EXERCISE_ARCHETYPE_LABELS,
} from "@/domains/exercise/schema";
import { logExercise } from "@/domains/exercise/service";
import { FormField, TextInput, SelectInput, TextArea, optionalNumberValue, optionalStringValue } from "@/platform/ui/FormField";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExerciseLogForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExerciseLogInput>({
    resolver: zodResolver(exerciseLogSchema),
    defaultValues: { date: todayDateString() },
  });

  const onSubmit = (values: ExerciseLogInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await logExercise(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Log exercise</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Date" htmlFor="date" error={errors.date?.message}>
          <TextInput id="date" type="date" autoFocus {...register("date")} />
        </FormField>
        <FormField label="Session type" htmlFor="archetype">
          <SelectInput id="archetype" {...register("archetype", { setValueAs: optionalStringValue })}>
            <option value="">—</option>
            {EXERCISE_ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {EXERCISE_ARCHETYPE_LABELS[a]}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Duration (minutes)" htmlFor="durationMinutes">
            <TextInput
              id="durationMinutes"
              type="number"
              min={0}
              {...register("durationMinutes", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Perceived exertion (1-10)" htmlFor="perceivedExertion">
            <SelectInput
              id="perceivedExertion"
              {...register("perceivedExertion", { setValueAs: optionalNumberValue })}
            >
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>
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
