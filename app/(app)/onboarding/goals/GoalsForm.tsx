"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { goalsStepSchema, type GoalsStepInput } from "@/domains/goals/schema";
import { DOMAIN_KEYS } from "@/domains/goals/schema";
import { saveGoalsStep } from "@/domains/goals/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, SelectInput, TextArea } from "@/platform/ui/FormField";

const EMPTY_GOAL: GoalsStepInput["goals"][number] = {
  domainKey: "general",
  outcome: "",
  why: "",
  targetDate: "",
  startingState: "",
  constraints: "",
  successCriteria: "",
  priority: 3,
  confidence: 3,
  knownObstacles: "",
};

export function GoalsForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
}: {
  userId: string;
  defaultValues: GoalsStepInput;
  stepIndex: number;
  totalSteps: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<GoalsStepInput>({
    resolver: zodResolver(goalsStepSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "goals" });

  const onSubmit = (values: GoalsStepInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveGoalsStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding/nutrition");
    });
  };

  return (
    <StepShell
      title="Your goals"
      description="What outcomes do you want? LifeOS will work out the technical targets."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref="/onboarding/identity"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">Goal {index + 1}</span>
              {fields.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <FormField
              label="Desired outcome"
              htmlFor={`goals.${index}.outcome`}
              error={errors.goals?.[index]?.outcome?.message}
              hint='e.g. "Weigh 200 pounds by February"'
            >
              <TextInput id={`goals.${index}.outcome`} {...register(`goals.${index}.outcome`)} />
            </FormField>

            <FormField label="Why it matters" htmlFor={`goals.${index}.why`}>
              <TextArea id={`goals.${index}.why`} {...register(`goals.${index}.why`)} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Target date" htmlFor={`goals.${index}.targetDate`}>
                <TextInput
                  id={`goals.${index}.targetDate`}
                  type="date"
                  {...register(`goals.${index}.targetDate`)}
                />
              </FormField>
              <FormField
                label="Related area"
                htmlFor={`goals.${index}.domainKey`}
                error={errors.goals?.[index]?.domainKey?.message}
              >
                <SelectInput id={`goals.${index}.domainKey`} {...register(`goals.${index}.domainKey`)}>
                  {DOMAIN_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key[0].toUpperCase() + key.slice(1)}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>

            <FormField label="Starting point" htmlFor={`goals.${index}.startingState`}>
              <TextInput id={`goals.${index}.startingState`} {...register(`goals.${index}.startingState`)} />
            </FormField>

            <FormField label="Constraints" htmlFor={`goals.${index}.constraints`}>
              <TextInput id={`goals.${index}.constraints`} {...register(`goals.${index}.constraints`)} />
            </FormField>

            <FormField label="What success looks like" htmlFor={`goals.${index}.successCriteria`}>
              <TextInput id={`goals.${index}.successCriteria`} {...register(`goals.${index}.successCriteria`)} />
            </FormField>

            <FormField label="Known obstacles" htmlFor={`goals.${index}.knownObstacles`}>
              <TextInput id={`goals.${index}.knownObstacles`} {...register(`goals.${index}.knownObstacles`)} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Priority (1 = highest)" htmlFor={`goals.${index}.priority`}>
                <SelectInput
                  id={`goals.${index}.priority`}
                  {...register(`goals.${index}.priority`, { valueAsNumber: true })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Confidence (1-5)" htmlFor={`goals.${index}.confidence`}>
                <SelectInput
                  id={`goals.${index}.confidence`}
                  {...register(`goals.${index}.confidence`, { valueAsNumber: true })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>
          </div>
        ))}

        {errors.goals?.message ? (
          <p className="text-sm text-red-600">{errors.goals.message}</p>
        ) : null}

        <button
          type="button"
          onClick={() => append(EMPTY_GOAL)}
          className="w-full rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          + Add another goal
        </button>

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
