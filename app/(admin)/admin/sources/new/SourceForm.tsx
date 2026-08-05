"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sourceSchema, type SourceInput } from "@/domains/expertregistry/schema";
import { createSource } from "@/domains/expertregistry/service";
import { FormField, TextInput, SelectInput, optionalStringValue } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Expert } from "@/domains/expertregistry/types";

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

export function SourceForm({ experts }: { experts: Expert[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SourceInput>({
    resolver: zodResolver(sourceSchema),
    defaultValues: { accessedAt: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = (values: SourceInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createSource(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/admin/sources");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="Title" htmlFor="title" error={errors.title?.message}>
        <TextInput id="title" {...register("title")} />
      </FormField>

      <FormField label="Canonical URL" htmlFor="canonicalUrl" error={errors.canonicalUrl?.message}>
        <TextInput id="canonicalUrl" type="url" {...register("canonicalUrl")} />
      </FormField>

      <FormField label="Organization" htmlFor="organization" error={errors.organization?.message}>
        <TextInput id="organization" {...register("organization")} />
      </FormField>

      <FormField label="Source type" htmlFor="sourceType" error={errors.sourceType?.message}>
        <SelectInput id="sourceType" {...register("sourceType")}>
          {SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField
        label="Expert"
        htmlFor="expertId"
        error={errors.expertId?.message}
        hint="Optional for institutional sources (certifying/governing bodies)."
      >
        <SelectInput id="expertId" {...register("expertId", { setValueAs: optionalStringValue })}>
          <option value="">—</option>
          {experts.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Published"
          htmlFor="publishedAt"
          error={errors.publishedAt?.message}
          hint="Optional"
        >
          <TextInput id="publishedAt" type="date" {...register("publishedAt")} />
        </FormField>
        <FormField label="Accessed" htmlFor="accessedAt" error={errors.accessedAt?.message}>
          <TextInput id="accessedAt" type="date" {...register("accessedAt")} />
        </FormField>
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create source"}
      </Button>
    </form>
  );
}
