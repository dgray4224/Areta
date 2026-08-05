"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expertSchema, slugify, csvToArray, type ExpertInput } from "@/domains/expertregistry/schema";
import { createExpert } from "@/domains/expertregistry/service";
import { FormField, TextInput, SelectInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function ExpertForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpertInput>({
    resolver: zodResolver(expertSchema),
    defaultValues: { entityType: "person" },
  });

  const name = watch("name");

  const onSubmit = (values: ExpertInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createExpert(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/admin/experts/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="Name" htmlFor="name" error={errors.name?.message}>
        <TextInput id="name" {...register("name")} />
      </FormField>

      <FormField
        label="Slug"
        htmlFor="slug"
        error={errors.slug?.message}
        hint="Auto-filled from name — edit if it collides with an existing expert."
      >
        <TextInput
          id="slug"
          {...register("slug")}
          onFocus={(e) => {
            if (!e.target.value && name) setValue("slug", slugify(name));
          }}
        />
      </FormField>

      <FormField label="Entity type" htmlFor="entityType" error={errors.entityType?.message}>
        <SelectInput id="entityType" {...register("entityType")}>
          <option value="person">Person</option>
          <option value="institution">Institution</option>
        </SelectInput>
      </FormField>

      <FormField
        label="Roles"
        htmlFor="roles"
        error={errors.roles?.message}
        hint="Comma-separated, e.g. strength coach, physical therapist"
      >
        <TextInput id="roles" {...register("roles", { setValueAs: csvToArray })} />
      </FormField>

      <FormField
        label="Specialties"
        htmlFor="specialties"
        error={errors.specialties?.message}
        hint="Comma-separated, e.g. hypertrophy, injury rehab"
      >
        <TextInput id="specialties" {...register("specialties", { setValueAs: csvToArray })} />
      </FormField>

      <FormField
        label="Inclusion reason"
        htmlFor="inclusionReason"
        error={errors.inclusionReason?.message}
        hint="Why this expert belongs in the registry — required credibility context for the review."
      >
        <TextInput id="inclusionReason" {...register("inclusionReason")} />
      </FormField>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create expert"}
      </Button>
    </form>
  );
}
