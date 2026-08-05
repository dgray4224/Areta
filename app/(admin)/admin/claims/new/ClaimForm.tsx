"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  expertClaimSchema,
  csvToArray,
  type ExpertClaimInput,
} from "@/domains/expertregistry/schema";
import { createExpertClaim } from "@/domains/expertregistry/service";
import {
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  optionalStringValue,
  optionalNumberValue,
} from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Expert, Source } from "@/domains/expertregistry/types";
import type { Exercise } from "@/domains/exerciselibrary/types";

const CLAIM_TYPES = [
  "explicit_recommendation",
  "programming_rule",
  "technique_cue",
  "progression_rule",
  "regression",
  "caution",
  "demonstration_only",
  "inference",
] as const;

export function ClaimForm({
  experts,
  sources,
  exercises,
}: {
  experts: Expert[];
  sources: Source[];
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpertClaimInput>({
    resolver: zodResolver(expertClaimSchema),
    defaultValues: { confidence: "medium", claimType: "explicit_recommendation" },
  });

  const onSubmit = (values: ExpertClaimInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createExpertClaim(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/admin/claims/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Expert" htmlFor="expertId" error={errors.expertId?.message}>
          <SelectInput id="expertId" {...register("expertId")}>
            <option value="">—</option>
            {experts.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Source" htmlFor="sourceId" error={errors.sourceId?.message}>
          <SelectInput id="sourceId" {...register("sourceId")}>
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>

      <FormField label="Claim type" htmlFor="claimType" error={errors.claimType?.message}>
        <SelectInput id="claimType" {...register("claimType")}>
          {CLAIM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label="Topic" htmlFor="topic" error={errors.topic?.message}>
        <TextInput id="topic" {...register("topic")} placeholder="e.g. shoulder impingement" />
      </FormField>

      <FormField
        label="Normalized claim"
        htmlFor="normalizedClaim"
        error={errors.normalizedClaim?.message}
        hint="A single, atomic, source-cited statement — not a paraphrase of a whole video."
      >
        <TextArea id="normalizedClaim" {...register("normalizedClaim")} />
      </FormField>

      <FormField label="Short rationale" htmlFor="shortRationale" error={errors.shortRationale?.message}>
        <TextArea id="shortRationale" {...register("shortRationale")} rows={2} />
      </FormField>

      <FormField
        label="Verbatim excerpt"
        htmlFor="verbatimExcerpt"
        error={errors.verbatimExcerpt?.message}
        hint="Optional — direct quote from the source, for review-time verification."
      >
        <TextArea id="verbatimExcerpt" {...register("verbatimExcerpt")} rows={2} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Exercise"
          htmlFor="exerciseId"
          error={errors.exerciseId?.message}
          hint="Optional — leave blank if this claim is about a movement pattern generally."
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
          hint="Optional — e.g. horizontal_push"
        >
          <TextInput id="movementPattern" {...register("movementPattern")} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Applicable goals"
          htmlFor="applicableGoals"
          error={errors.applicableGoals?.message}
          hint="Comma-separated"
        >
          <TextInput id="applicableGoals" {...register("applicableGoals", { setValueAs: csvToArray })} />
        </FormField>
        <FormField
          label="Applicable levels"
          htmlFor="applicableLevels"
          error={errors.applicableLevels?.message}
          hint="Comma-separated"
        >
          <TextInput id="applicableLevels" {...register("applicableLevels", { setValueAs: csvToArray })} />
        </FormField>
        <FormField
          label="Required equipment"
          htmlFor="requiredEquipment"
          error={errors.requiredEquipment?.message}
          hint="Comma-separated"
        >
          <TextInput id="requiredEquipment" {...register("requiredEquipment", { setValueAs: csvToArray })} />
        </FormField>
        <FormField
          label="Excluded conditions"
          htmlFor="excludedConditions"
          error={errors.excludedConditions?.message}
          hint="Comma-separated limitation tags this claim doesn't apply under"
        >
          <TextInput
            id="excludedConditions"
            {...register("excludedConditions", { setValueAs: csvToArray })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Confidence" htmlFor="confidence" error={errors.confidence?.message}>
          <SelectInput id="confidence" {...register("confidence")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </SelectInput>
        </FormField>
        <FormField
          label="Timestamp (sec)"
          htmlFor="timestampSeconds"
          error={errors.timestampSeconds?.message}
          hint="Optional — video sources"
        >
          <TextInput
            id="timestampSeconds"
            type="number"
            {...register("timestampSeconds", { setValueAs: optionalNumberValue })}
          />
        </FormField>
        <FormField
          label="Page number"
          htmlFor="pageNumber"
          error={errors.pageNumber?.message}
          hint="Optional — PDF/print sources"
        >
          <TextInput
            id="pageNumber"
            type="number"
            {...register("pageNumber", { setValueAs: optionalNumberValue })}
          />
        </FormField>
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create claim"}
      </Button>
    </form>
  );
}
