"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { learningSchema, type LearningInput } from "@/domains/learning/schema";
import { saveLearningStep } from "@/domains/learning/service";
import { StepShell } from "@/platform/ui/StepShell";
import {
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  optionalNumberValue,
  optionalStringValue,
} from "@/platform/ui/FormField";

export function LearningForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
}: {
  userId: string;
  defaultValues: Partial<LearningInput>;
  stepIndex: number;
  totalSteps: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LearningInput>({
    resolver: zodResolver(learningSchema),
    defaultValues,
  });

  const onSubmit = (values: LearningInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveLearningStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding/coaching");
    });
  };

  return (
    <StepShell
      title="Learning"
      description="What are you working toward professionally or academically?"
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref="/onboarding/recovery"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Career direction" htmlFor="careerDirection">
          <TextInput id="careerDirection" {...register("careerDirection")} />
        </FormField>
        <FormField label="Current skills" htmlFor="currentSkills">
          <TextArea id="currentSkills" {...register("currentSkills")} />
        </FormField>
        <FormField label="Desired skills" htmlFor="desiredSkills">
          <TextArea id="desiredSkills" {...register("desiredSkills")} />
        </FormField>
        <FormField label="Current projects" htmlFor="currentProjects">
          <TextArea id="currentProjects" {...register("currentProjects")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Preferred format" htmlFor="preferredFormat" error={errors.preferredFormat?.message}>
            <SelectInput
              id="preferredFormat"
              {...register("preferredFormat", { setValueAs: optionalStringValue })}
            >
              <option value="">—</option>
              <option value="reading">Reading</option>
              <option value="video">Video</option>
              <option value="project">Hands-on project</option>
              <option value="course">Structured course</option>
              <option value="mixed">Mixed</option>
            </SelectInput>
          </FormField>
          <FormField label="Weekly hours available" htmlFor="weeklyAvailableHours">
            <TextInput
              id="weeklyAvailableHours"
              type="number"
              min={0}
              {...register("weeklyAvailableHours", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>
        <FormField label="Formal course plans" htmlFor="formalCoursePlans" hint="e.g. a degree program starting a specific term">
          <TextInput id="formalCoursePlans" {...register("formalCoursePlans")} />
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
