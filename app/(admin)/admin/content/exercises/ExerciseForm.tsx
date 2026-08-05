"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { exerciseAdminSchema, type ExerciseAdminInput } from "@/domains/exerciselibrary/schema";
import { createExerciseAdmin, updateExerciseAdmin } from "@/domains/exerciselibrary/service";
import { csvToArray } from "@/domains/expertregistry/schema";
import {
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  optionalStringValue,
} from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

function csvDefault(values: string[] | undefined): string {
  return values?.join(", ") ?? "";
}

export function ExerciseForm({
  mode,
  exerciseId,
  defaultValues,
}: {
  mode: "create" | "edit";
  exerciseId?: string;
  defaultValues?: Partial<ExerciseAdminInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Only the scalar fields go through react-hook-form's own defaultValues
  // machinery. The array-typed fields (equipment, muscle groups, tags, …)
  // are edited as comma-separated text and only turned back into arrays
  // at submit time via `csvToArray` (see each field's `setValueAs`
  // below); if they were included here too, react-hook-form would *also*
  // try to set each uncontrolled input's initial DOM value straight from
  // the array on mount — a second, conflicting source of truth for the
  // same display value that the explicit `defaultValue={csvDefault(...)}`
  // props further down already own.
  const scalarDefaultValues: Partial<ExerciseAdminInput> = {
    name: defaultValues?.name,
    canonicalName: defaultValues?.canonicalName,
    movementPattern: defaultValues?.movementPattern,
    difficulty: defaultValues?.difficulty,
    modality: defaultValues?.modality,
    unilateral: defaultValues?.unilateral,
    compound: defaultValues?.compound,
    contraindicationNotes: defaultValues?.contraindicationNotes,
    instructions: defaultValues?.instructions,
    imageUrl: defaultValues?.imageUrl,
    videoUrl: defaultValues?.videoUrl,
    status: defaultValues?.status,
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExerciseAdminInput>({
    resolver: zodResolver(exerciseAdminSchema),
    defaultValues: {
      difficulty: "beginner",
      status: "review",
      unilateral: false,
      compound: false,
      ...scalarDefaultValues,
    },
  });

  const onSubmit = (values: ExerciseAdminInput) => {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      if (mode === "create") {
        const result = await createExerciseAdmin(values);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        router.push(`/admin/content/exercises/${result.data.id}`);
      } else {
        const result = await updateExerciseAdmin(exerciseId!, values);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        setSaved(true);
      }
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name" htmlFor="name" error={errors.name?.message}>
          <TextInput id="name" {...register("name")} />
        </FormField>
        <FormField
          label="Canonical name"
          htmlFor="canonicalName"
          error={errors.canonicalName?.message}
          hint="Usually the same as Name"
        >
          <TextInput id="canonicalName" {...register("canonicalName")} />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Movement pattern" htmlFor="movementPattern" error={errors.movementPattern?.message}>
          <TextInput id="movementPattern" {...register("movementPattern")} placeholder="e.g. horizontal_push" />
        </FormField>
        <FormField label="Difficulty" htmlFor="difficulty" error={errors.difficulty?.message}>
          <SelectInput id="difficulty" {...register("difficulty")}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </SelectInput>
        </FormField>
        <FormField
          label="Modality"
          htmlFor="modality"
          error={errors.modality?.message}
          hint="Optional"
        >
          <SelectInput id="modality" {...register("modality", { setValueAs: optionalStringValue })}>
            <option value="">—</option>
            <option value="resistance">Resistance</option>
            <option value="aerobic">Aerobic</option>
            <option value="mobility">Mobility</option>
            <option value="power">Power</option>
          </SelectInput>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Equipment required"
          htmlFor="equipmentRequired"
          error={errors.equipmentRequired?.message}
          hint="Comma-separated"
        >
          <TextInput
            id="equipmentRequired"
            defaultValue={csvDefault(defaultValues?.equipmentRequired)}
            {...register("equipmentRequired", { setValueAs: csvToArray })}
          />
        </FormField>
        <FormField
          label="Archetype tags"
          htmlFor="archetypeTags"
          error={errors.archetypeTags?.message}
          hint="Comma-separated"
        >
          <TextInput
            id="archetypeTags"
            defaultValue={csvDefault(defaultValues?.archetypeTags)}
            {...register("archetypeTags", { setValueAs: csvToArray })}
          />
        </FormField>
        <FormField
          label="Primary muscle groups"
          htmlFor="primaryMuscleGroups"
          error={errors.primaryMuscleGroups?.message}
          hint="Comma-separated"
        >
          <TextInput
            id="primaryMuscleGroups"
            defaultValue={csvDefault(defaultValues?.primaryMuscleGroups)}
            {...register("primaryMuscleGroups", { setValueAs: csvToArray })}
          />
        </FormField>
        <FormField
          label="Secondary muscle groups"
          htmlFor="secondaryMuscleGroups"
          error={errors.secondaryMuscleGroups?.message}
          hint="Comma-separated"
        >
          <TextInput
            id="secondaryMuscleGroups"
            defaultValue={csvDefault(defaultValues?.secondaryMuscleGroups)}
            {...register("secondaryMuscleGroups", { setValueAs: csvToArray })}
          />
        </FormField>
        <FormField label="Aliases" htmlFor="aliases" error={errors.aliases?.message} hint="Comma-separated">
          <TextInput
            id="aliases"
            defaultValue={csvDefault(defaultValues?.aliases)}
            {...register("aliases", { setValueAs: csvToArray })}
          />
        </FormField>
        <FormField
          label="Setup requirements"
          htmlFor="setupRequirements"
          error={errors.setupRequirements?.message}
          hint="Comma-separated"
        >
          <TextInput
            id="setupRequirements"
            defaultValue={csvDefault(defaultValues?.setupRequirements)}
            {...register("setupRequirements", { setValueAs: csvToArray })}
          />
        </FormField>
      </div>

      <FormField
        label="Limitation tags"
        htmlFor="limitationTags"
        error={errors.limitationTags?.message}
        hint="Comma-separated — cross-references domains/expertregistry's limitation_rules"
      >
        <TextInput
          id="limitationTags"
          defaultValue={csvDefault(defaultValues?.limitationTags)}
          {...register("limitationTags", { setValueAs: csvToArray })}
        />
      </FormField>

      <FormField
        label="Contraindication notes"
        htmlFor="contraindicationNotes"
        error={errors.contraindicationNotes?.message}
        hint="Optional"
      >
        <TextArea id="contraindicationNotes" {...register("contraindicationNotes")} rows={2} />
      </FormField>

      <FormField label="Instructions" htmlFor="instructions" error={errors.instructions?.message} hint="Optional">
        <TextArea id="instructions" {...register("instructions")} rows={3} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Image URL" htmlFor="imageUrl" error={errors.imageUrl?.message} hint="Optional">
          <TextInput id="imageUrl" {...register("imageUrl")} />
        </FormField>
        <FormField label="Video URL" htmlFor="videoUrl" error={errors.videoUrl?.message} hint="Optional">
          <TextInput id="videoUrl" {...register("videoUrl")} />
        </FormField>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("unilateral")} />
          Unilateral
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("compound")} />
          Compound
        </label>
      </div>

      <FormField
        label="Status"
        htmlFor="status"
        error={errors.status?.message}
        hint={
          mode === "create"
            ? "New exercises default to \"review\" — set to \"active\" once you've checked it over."
            : undefined
        }
      >
        <SelectInput id="status" {...register("status")}>
          <option value="review">Review</option>
          <option value="active">Active</option>
          <option value="deprecated">Deprecated</option>
        </SelectInput>
      </FormField>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : mode === "create" ? "Create exercise" : "Save changes"}
      </Button>
    </form>
  );
}
