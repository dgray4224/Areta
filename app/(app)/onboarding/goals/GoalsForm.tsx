"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { goalsStepSchema, type GoalsStepInput } from "@/domains/goals/schema";
import { V1_DOMAIN_KEYS, DOMAIN_LABELS, GOAL_TARGET_METRIC_TYPES } from "@/domains/goals/schema";
import { saveGoalsStep } from "@/domains/goals/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, SelectInput } from "@/platform/ui/FormField";
import { chipBase, chipSelected, chipUnselected } from "@/platform/ui/TagPicker";
import { Button } from "@/platform/ui/Button";

const EMPTY_GOAL: GoalsStepInput["goals"][number] = {
  domainKey: "health",
  outcome: "",
  why: "",
  targetDate: "",
  startingState: "",
  constraints: "",
  successCriteria: "",
  priority: 3,
  confidence: 3,
  knownObstacles: "",
  targetMetricType: undefined,
  targetValue: undefined,
  targetDirection: undefined,
};

/** Labels for the closed set of metrics the weekly-review engine's
 * goal-trajectory projection can track (domains/review/trajectory.ts). */
const GOAL_TARGET_METRIC_LABELS: Record<(typeof GOAL_TARGET_METRIC_TYPES)[number], string> = {
  weight_lb: "Weight (lb)",
  calorie_adherence_pct: "Calorie adherence (%)",
  protein_adherence_pct: "Protein adherence (%)",
  task_completion_pct: "Task completion (%)",
  learning_minutes_weekly: "Learning minutes / week",
};

/** react-hook-form quirk: a native `<select>`'s empty option always comes
 * through as `""`, which fails these optional zod enum/number fields
 * (`.optional()` accepts `undefined`, not `""`) — `setValueAs` normalizes
 * the sentinel back to `undefined` before validation runs. */
const emptyStringToUndefined = (v: string) => (v === "" ? undefined : v);

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

  const toggleDomain = (key: (typeof V1_DOMAIN_KEYS)[number]) => {
    const existingIndex = fields.findIndex((f) => f.domainKey === key);
    if (existingIndex >= 0) {
      remove(existingIndex);
    } else {
      append({ ...EMPTY_GOAL, domainKey: key });
    }
  };

  const onSubmit = (values: GoalsStepInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveGoalsStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding");
    });
  };

  return (
    <StepShell
      title="Your goals"
      description="What outcomes do you want? Areta will work out the technical targets."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref="/onboarding/identity"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div>
          <p className="text-sm font-medium">What areas do you want to work on?</p>
          <p className="mt-1 text-xs text-neutral-500">
            Pick any that apply — Areta only asks follow-up questions for the areas you choose.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {V1_DOMAIN_KEYS.map((key) => {
              const isSelected = fields.some((f) => f.domainKey === key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDomain(key)}
                  className={`${chipBase} ${isSelected ? chipSelected : chipUnselected}`}
                >
                  {DOMAIN_LABELS[key]}
                </button>
              );
            })}
          </div>
          {fields.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              Optional — pick an area to set a goal, or continue without one (you can add goals later).
            </p>
          ) : null}
        </div>

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
              label="Goal"
              htmlFor={`goals.${index}.outcome`}
              error={errors.goals?.[index]?.outcome?.message}
              hint='e.g. "Weigh 200 pounds by February"'
            >
              <TextInput id={`goals.${index}.outcome`} {...register(`goals.${index}.outcome`)} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Target date"
                htmlFor={`goals.${index}.targetDate`}
                hint="Approximately when do you want to accomplish this?"
              >
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
                  {V1_DOMAIN_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {DOMAIN_LABELS[key]}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>

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

            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-medium">Track progress toward a number? (optional)</p>
              <p className="mt-1 text-xs text-neutral-500">
                Lets your weekly review show whether you're on pace to hit this by your target date.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <FormField label="Metric" htmlFor={`goals.${index}.targetMetricType`}>
                  <SelectInput
                    id={`goals.${index}.targetMetricType`}
                    {...register(`goals.${index}.targetMetricType`, { setValueAs: emptyStringToUndefined })}
                  >
                    <option value="">No target</option>
                    {GOAL_TARGET_METRIC_TYPES.map((key) => (
                      <option key={key} value={key}>
                        {GOAL_TARGET_METRIC_LABELS[key]}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Target value" htmlFor={`goals.${index}.targetValue`}>
                  <TextInput
                    id={`goals.${index}.targetValue`}
                    type="number"
                    step="any"
                    {...register(`goals.${index}.targetValue`, {
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                  />
                </FormField>
                <FormField label="Direction" htmlFor={`goals.${index}.targetDirection`}>
                  <SelectInput
                    id={`goals.${index}.targetDirection`}
                    {...register(`goals.${index}.targetDirection`, { setValueAs: emptyStringToUndefined })}
                  >
                    <option value="">—</option>
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </SelectInput>
                </FormField>
              </div>
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

        <Button type="submit" variant="primary" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : fields.length === 0 ? "Continue without a goal" : "Continue"}
        </Button>
      </form>
    </StepShell>
  );
}
