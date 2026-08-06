"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  evidenceBundleSchema,
  slugify,
  csvToArray,
  type EvidenceBundleInput,
} from "@/domains/expertregistry/schema";
import { createEvidenceBundle } from "@/domains/expertregistry/service";
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

const SOURCE_TYPES = [
  "peer_reviewed",
  "official_expert_content",
  "long_form_official_video",
  "official_short_form",
  "reputable_interview",
  "third_party_summary",
  "social_post",
  "certifying_body",
  "governing_body",
] as const;

function SectionHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 dark:border-neutral-800">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink">
        {step}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

export function EvidenceBundleForm({
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
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EvidenceBundleInput>({
    resolver: zodResolver(evidenceBundleSchema),
    defaultValues: {
      expertMode: experts.length > 0 ? "existing" : "new",
      expertEntityType: "person",
      expertRoles: [],
      expertSpecialties: [],
      sourceMode: sources.length > 0 ? "existing" : "new",
      sourceAccessedAt: new Date().toISOString().slice(0, 10),
      claimType: "explicit_recommendation",
      applicableGoals: [],
      applicableLevels: [],
      requiredEquipment: [],
      excludedConditions: [],
      confidence: "medium",
      includeLimitationRule: false,
      ruleAction: "exclude",
    },
  });

  const expertMode = watch("expertMode");
  const expertName = watch("expertName");
  const sourceMode = watch("sourceMode");
  const includeLimitationRule = watch("includeLimitationRule");
  const ruleAction = watch("ruleAction");

  const onSubmit = (values: EvidenceBundleInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createEvidenceBundle(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/admin/claims/${result.data.claimId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {/* 1. Expert */}
      <section className="space-y-4">
        <SectionHeader step={1} title="Expert" />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" value="existing" {...register("expertMode")} disabled={experts.length === 0} />
            Use existing
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="new" {...register("expertMode")} />
            Add new
          </label>
        </div>

        {expertMode === "existing" ? (
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
        ) : (
          <div className="space-y-4">
            <FormField label="Name" htmlFor="expertName" error={errors.expertName?.message}>
              <TextInput id="expertName" {...register("expertName")} />
            </FormField>
            <FormField
              label="Slug"
              htmlFor="expertSlug"
              error={errors.expertSlug?.message}
              hint="Auto-filled from name — edit if it collides with an existing expert."
            >
              <TextInput
                id="expertSlug"
                {...register("expertSlug")}
                onFocus={(e) => {
                  if (!e.target.value && expertName) setValue("expertSlug", slugify(expertName));
                }}
              />
            </FormField>
            <FormField label="Entity type" htmlFor="expertEntityType" error={errors.expertEntityType?.message}>
              <SelectInput id="expertEntityType" {...register("expertEntityType")}>
                <option value="person">Person</option>
                <option value="institution">Institution</option>
              </SelectInput>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Roles"
                htmlFor="expertRoles"
                error={errors.expertRoles?.message}
                hint="Comma-separated"
              >
                <TextInput id="expertRoles" {...register("expertRoles", { setValueAs: csvToArray })} />
              </FormField>
              <FormField
                label="Specialties"
                htmlFor="expertSpecialties"
                error={errors.expertSpecialties?.message}
                hint="Comma-separated"
              >
                <TextInput
                  id="expertSpecialties"
                  {...register("expertSpecialties", { setValueAs: csvToArray })}
                />
              </FormField>
            </div>
            <FormField
              label="Inclusion reason"
              htmlFor="expertInclusionReason"
              error={errors.expertInclusionReason?.message}
              hint="Why this expert belongs in the registry."
            >
              <TextInput id="expertInclusionReason" {...register("expertInclusionReason")} />
            </FormField>
          </div>
        )}
      </section>

      {/* 2. Source */}
      <section className="space-y-4">
        <SectionHeader step={2} title="Source" />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" value="existing" {...register("sourceMode")} disabled={sources.length === 0} />
            Use existing
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="new" {...register("sourceMode")} />
            Add new
          </label>
        </div>

        {sourceMode === "existing" ? (
          <FormField label="Source" htmlFor="sourceId" error={errors.sourceId?.message}>
            <SelectInput id="sourceId" {...register("sourceId")}>
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.expertName ? ` (${s.expertName})` : ""}
                </option>
              ))}
            </SelectInput>
          </FormField>
        ) : (
          <div className="space-y-4">
            <FormField label="Title" htmlFor="sourceTitle" error={errors.sourceTitle?.message}>
              <TextInput id="sourceTitle" {...register("sourceTitle")} />
            </FormField>
            <FormField
              label="Canonical URL"
              htmlFor="sourceCanonicalUrl"
              error={errors.sourceCanonicalUrl?.message}
            >
              <TextInput id="sourceCanonicalUrl" type="url" {...register("sourceCanonicalUrl")} />
            </FormField>
            <FormField label="Organization" htmlFor="sourceOrganization" error={errors.sourceOrganization?.message}>
              <TextInput id="sourceOrganization" {...register("sourceOrganization")} />
            </FormField>
            <FormField label="Source type" htmlFor="sourceType" error={errors.sourceType?.message}>
              <SelectInput id="sourceType" {...register("sourceType")}>
                <option value="">—</option>
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Published"
                htmlFor="sourcePublishedAt"
                error={errors.sourcePublishedAt?.message}
                hint="Optional"
              >
                <TextInput id="sourcePublishedAt" type="date" {...register("sourcePublishedAt")} />
              </FormField>
              <FormField label="Accessed" htmlFor="sourceAccessedAt" error={errors.sourceAccessedAt?.message}>
                <TextInput id="sourceAccessedAt" type="date" {...register("sourceAccessedAt")} />
              </FormField>
            </div>
            <p className="text-xs text-neutral-500">
              Attributed to the expert selected above — a new source can&apos;t be created for a
              different expert than the one this submission is about.
            </p>
          </div>
        )}
      </section>

      {/* 3. Claim */}
      <section className="space-y-4">
        <SectionHeader step={3} title="Claim" />

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
      </section>

      {/* 4. Limitation rule (optional) */}
      <section className="space-y-4">
        <SectionHeader step={4} title="Limitation rule (optional)" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("includeLimitationRule")} />
          Also add a limitation rule cited from this same source
        </label>

        {includeLimitationRule ? (
          <div className="space-y-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
            <FormField
              label="Limitation tag"
              htmlFor="ruleLimitationTag"
              error={errors.ruleLimitationTag?.message}
              hint="e.g. knee_flexion_limited, shoulder_impingement"
            >
              <TextInput id="ruleLimitationTag" {...register("ruleLimitationTag")} />
            </FormField>

            <FormField label="Action" htmlFor="ruleAction" error={errors.ruleAction?.message}>
              <SelectInput id="ruleAction" {...register("ruleAction")}>
                <option value="exclude">Exclude (hard filter)</option>
                <option value="substitute">Substitute</option>
                <option value="manual_review">Manual review</option>
              </SelectInput>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Exercise"
                htmlFor="ruleExerciseId"
                error={errors.ruleExerciseId?.message}
                hint="Target either this or a movement pattern, not both"
              >
                <SelectInput
                  id="ruleExerciseId"
                  {...register("ruleExerciseId", { setValueAs: optionalStringValue })}
                >
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
                htmlFor="ruleMovementPattern"
                error={errors.ruleMovementPattern?.message}
              >
                <TextInput id="ruleMovementPattern" {...register("ruleMovementPattern")} />
              </FormField>
            </div>

            {ruleAction === "substitute" ? (
              <FormField
                label="Substitute movement pattern"
                htmlFor="ruleSubstituteMovementPattern"
                error={errors.ruleSubstituteMovementPattern?.message}
              >
                <TextInput id="ruleSubstituteMovementPattern" {...register("ruleSubstituteMovementPattern")} />
              </FormField>
            ) : null}

            <FormField label="Rationale" htmlFor="ruleRationale" error={errors.ruleRationale?.message}>
              <TextArea id="ruleRationale" {...register("ruleRationale")} />
              <button
                type="button"
                className="mt-1 text-xs text-neutral-500 hover:underline"
                onClick={() => setValue("ruleRationale", getValues("shortRationale"))}
              >
                Copy the claim&apos;s short rationale
              </button>
            </FormField>
          </div>
        ) : null}
      </section>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create evidence"}
      </Button>
    </form>
  );
}
