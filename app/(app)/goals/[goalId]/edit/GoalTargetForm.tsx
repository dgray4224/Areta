"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { GOAL_TARGET_METRIC_TYPES, type GoalTargetInput } from "@/domains/goals/schema";
import { setGoalTarget, type GoalDetail } from "@/domains/goals/service";
import { FormField, TextInput, SelectInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

/** Labels for the closed set of metrics the weekly-review engine's
 * goal-trajectory projection can track (domains/review/trajectory.ts) —
 * same wording as onboarding's GoalsForm.tsx, kept in sync manually since
 * this is display-only content, not shared business logic. */
const GOAL_TARGET_METRIC_LABELS: Record<(typeof GOAL_TARGET_METRIC_TYPES)[number], string> = {
  weight_lb: "Weight (lb)",
  calorie_adherence_pct: "Calorie adherence (%)",
  protein_adherence_pct: "Protein adherence (%)",
  task_completion_pct: "Task completion (%)",
  learning_minutes_weekly: "Learning minutes / week",
};

/** react-hook-form quirk: a native `<select>`'s empty option always comes
 * through as `""`, which fails the nullable enum/number fields below
 * (`.nullable()` accepts `null`, not `""`). */
const emptyStringToNull = (v: string) => (v === "" ? null : v);

export function GoalTargetForm({ userId, goal }: { userId: string; goal: GoalDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // No client-side zod resolver here on purpose: goalTargetSchema's
  // "all three fields together, or all three cleared" cross-field .refine()
  // would otherwise block handleSubmit from ever calling the server action
  // when it fails, leaving the user with no visible error (react-hook-form
  // has no reliable automatic mapping for a root-level refine issue).
  // Validation is enforced server-side instead (setGoalTarget's own
  // goalTargetSchema.safeParse), surfaced reliably via serverError below.
  const { register, handleSubmit } = useForm<GoalTargetInput>({
    defaultValues: {
      targetMetricType: goal.targetMetricType,
      targetValue: goal.targetValue,
      targetDirection: goal.targetDirection,
    },
  });

  const submit = (values: GoalTargetInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await setGoalTarget(userId, goal.id, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/goals");
    });
  };

  const clearTarget = () => {
    setServerError(null);
    startTransition(async () => {
      const result = await setGoalTarget(userId, goal.id, {
        targetMetricType: null,
        targetValue: null,
        targetDirection: null,
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/goals");
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {goal.baselineValue !== null && goal.baselineRecordedAt ? (
        <p className="text-xs text-neutral-500">
          Baseline: {goal.baselineValue} as of {goal.baselineRecordedAt}. Changing the target value keeps this
          baseline; picking a different metric re-samples a new one.
        </p>
      ) : null}

      <FormField label="Metric" htmlFor="targetMetricType">
        <SelectInput
          id="targetMetricType"
          {...register("targetMetricType", { setValueAs: emptyStringToNull })}
        >
          <option value="">No target</option>
          {GOAL_TARGET_METRIC_TYPES.map((key) => (
            <option key={key} value={key}>
              {GOAL_TARGET_METRIC_LABELS[key]}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label="Target value" htmlFor="targetValue">
        <TextInput
          id="targetValue"
          type="number"
          step="any"
          {...register("targetValue", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
        />
      </FormField>

      <FormField label="Direction" htmlFor="targetDirection">
        <SelectInput id="targetDirection" {...register("targetDirection", { setValueAs: emptyStringToNull })}>
          <option value="">—</option>
          <option value="increase">Increase</option>
          <option value="decrease">Decrease</option>
        </SelectInput>
      </FormField>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
          {isPending ? "Saving…" : "Save target"}
        </Button>
        {goal.targetMetricType !== null ? (
          <Button type="button" variant="secondary" disabled={isPending} onClick={clearTarget}>
            Clear target
          </Button>
        ) : null}
      </div>
    </form>
  );
}
