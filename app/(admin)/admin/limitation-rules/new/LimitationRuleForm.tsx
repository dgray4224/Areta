"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  limitationRuleSchema,
  type LimitationRuleInput,
} from "@/domains/expertregistry/schema";
import { createLimitationRule } from "@/domains/expertregistry/service";
import {
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  optionalStringValue,
} from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Source } from "@/domains/expertregistry/types";
import type { Exercise } from "@/domains/exerciselibrary/types";

export function LimitationRuleForm({
  sources,
  exercises,
}: {
  sources: Source[];
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LimitationRuleInput>({
    resolver: zodResolver(limitationRuleSchema),
    defaultValues: { action: "exclude" },
  });

  const action = watch("action");

  const onSubmit = (values: LimitationRuleInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createLimitationRule(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/admin/limitation-rules/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label="Limitation tag"
        htmlFor="limitationTag"
        error={errors.limitationTag?.message}
        hint="e.g. knee_flexion_limited, shoulder_impingement"
      >
        <TextInput id="limitationTag" {...register("limitationTag")} />
      </FormField>

      <FormField label="Action" htmlFor="action" error={errors.action?.message}>
        <SelectInput id="action" {...register("action")}>
          <option value="exclude">Exclude (hard filter)</option>
          <option value="substitute">Substitute</option>
          <option value="manual_review">Manual review</option>
        </SelectInput>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Exercise"
          htmlFor="exerciseId"
          error={errors.exerciseId?.message}
          hint="Target either this or a movement pattern, not both"
        >
          <SelectInput id="exerciseId" {...register("exerciseId", { setValueAs: optionalStringValue })}>
            <option value="">—</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField
          label="Movement pattern"
          htmlFor="movementPattern"
          error={errors.movementPattern?.message}
        >
          <TextInput id="movementPattern" {...register("movementPattern")} />
        </FormField>
      </div>

      {action === "substitute" ? (
        <FormField
          label="Substitute movement pattern"
          htmlFor="substituteMovementPattern"
          error={errors.substituteMovementPattern?.message}
        >
          <TextInput id="substituteMovementPattern" {...register("substituteMovementPattern")} />
        </FormField>
      ) : null}

      <FormField label="Rationale" htmlFor="rationale" error={errors.rationale?.message}>
        <TextArea id="rationale" {...register("rationale")} />
      </FormField>

      <FormField
        label="Source"
        htmlFor="sourceId"
        error={errors.sourceId?.message}
        hint="Optional but recommended — cite clinical/professional guidance where possible"
      >
        <SelectInput id="sourceId" {...register("sourceId", { setValueAs: optionalStringValue })}>
          <option value="">—</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create rule"}
      </Button>
    </form>
  );
}
