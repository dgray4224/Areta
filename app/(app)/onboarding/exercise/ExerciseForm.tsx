"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EXERCISE_ARCHETYPES,
  EXERCISE_ARCHETYPE_LABELS,
  EXPERIENCE_LEVELS,
  EQUIPMENT_SUGGESTIONS,
  exerciseSchema,
  type ExerciseInput,
} from "@/domains/exercise/schema";
import { saveExerciseStep } from "@/domains/exercise/service";
import { StepShell } from "@/platform/ui/StepShell";
import {
  FormField,
  TextInput,
  TextArea,
  SelectInput,
  optionalNumberValue,
  optionalStringValue,
} from "@/platform/ui/FormField";
import { TagPicker } from "@/platform/ui/TagPicker";

export function ExerciseForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
  backHref,
}: {
  userId: string;
  defaultValues: Partial<ExerciseInput>;
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
  } = useForm<ExerciseInput>({
    resolver: zodResolver(exerciseSchema),
    defaultValues,
  });

  const onSubmit = (values: ExerciseInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveExerciseStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding");
    });
  };

  return (
    <StepShell
      title="Exercise"
      description="What kind of exerciser do you want to be? Areta builds your training plan around this."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          label="What type of exerciser do you want to be?"
          htmlFor="archetype"
          error={errors.archetype?.message}
        >
          <SelectInput id="archetype" {...register("archetype", { setValueAs: optionalStringValue })}>
            <option value="">—</option>
            {EXERCISE_ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {EXERCISE_ARCHETYPE_LABELS[a]}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Experience level" htmlFor="experienceLevel" error={errors.experienceLevel?.message}>
          <SelectInput
            id="experienceLevel"
            {...register("experienceLevel", { setValueAs: optionalStringValue })}
          >
            <option value="">—</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level[0].toUpperCase() + level.slice(1)}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Training phase length (weeks)"
            htmlFor="trainingPhaseLengthWeeks"
            hint="4-16 weeks is typical"
          >
            <TextInput
              id="trainingPhaseLengthWeeks"
              type="number"
              min={1}
              {...register("trainingPhaseLengthWeeks", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Days per week available" htmlFor="daysPerWeekAvailable">
            <TextInput
              id="daysPerWeekAvailable"
              type="number"
              min={1}
              max={7}
              {...register("daysPerWeekAvailable", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Minutes per session" htmlFor="sessionLengthMinutesAvailable">
            <TextInput
              id="sessionLengthMinutesAvailable"
              type="number"
              min={0}
              {...register("sessionLengthMinutesAvailable", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>

        <FormField label="Equipment access" htmlFor="equipmentAccess">
          <Controller
            name="equipmentAccess"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="equipmentAccess"
                suggestions={EQUIPMENT_SUGGESTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <FormField
          label="Anything physical we should account for (optional)"
          htmlFor="physicalLimitations"
          hint="Keep it light — a real injury or rehab situation belongs in the Recovery module"
        >
          <TextArea id="physicalLimitations" {...register("physicalLimitations")} />
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
