"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { coachingSchema, type CoachingInput } from "@/domains/coaching/schema";
import { saveCoachingStep } from "@/domains/coaching/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, SelectInput, TextInput } from "@/platform/ui/FormField";

export function CoachingForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
}: {
  userId: string;
  defaultValues: Partial<CoachingInput>;
  stepIndex: number;
  totalSteps: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [neverRecommendText, setNeverRecommendText] = useState(
    (defaultValues.neverRecommend ?? []).join(", ")
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CoachingInput>({
    resolver: zodResolver(coachingSchema),
    defaultValues: {
      tone: "gentle",
      planningStyle: "flexible",
      reminderPreference: "minimal",
      explanationDepth: "brief",
      rescheduleMissedTasks: true,
      neverRecommend: [],
      ...defaultValues,
    },
  });

  const onSubmit = (values: CoachingInput) => {
    setServerError(null);
    startTransition(async () => {
      const neverRecommend = neverRecommendText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await saveCoachingStep(userId, { ...values, neverRecommend });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding/review");
    });
  };

  return (
    <StepShell
      title="How should LifeOS coach you?"
      description="This shapes tone and pacing, not the underlying targets."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref="/onboarding/learning"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Tone" htmlFor="tone" error={errors.tone?.message}>
          <SelectInput id="tone" {...register("tone")}>
            <option value="direct">Direct</option>
            <option value="gentle">Gentle</option>
          </SelectInput>
        </FormField>
        <FormField label="Planning style" htmlFor="planningStyle" error={errors.planningStyle?.message}>
          <SelectInput id="planningStyle" {...register("planningStyle")}>
            <option value="strict">Strict</option>
            <option value="flexible">Flexible</option>
          </SelectInput>
        </FormField>
        <FormField label="Reminders" htmlFor="reminderPreference" error={errors.reminderPreference?.message}>
          <SelectInput id="reminderPreference" {...register("reminderPreference")}>
            <option value="frequent">Frequent</option>
            <option value="minimal">Minimal</option>
            <option value="none">None</option>
          </SelectInput>
        </FormField>
        <FormField label="Explanation depth" htmlFor="explanationDepth" error={errors.explanationDepth?.message}>
          <SelectInput id="explanationDepth" {...register("explanationDepth")}>
            <option value="brief">Brief</option>
            <option value="detailed">Detailed</option>
          </SelectInput>
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("rescheduleMissedTasks")} />
          Automatically reschedule missed tasks
        </label>

        <FormField
          label="Never recommend"
          htmlFor="neverRecommend"
          hint="Comma-separated foods or activities LifeOS should never suggest"
        >
          <TextInput
            id="neverRecommend"
            value={neverRecommendText}
            onChange={(e) => {
              setNeverRecommendText(e.target.value);
              setValue(
                "neverRecommend",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              );
            }}
          />
        </FormField>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isPending ? "Saving…" : "Review and finish"}
        </button>
      </form>
    </StepShell>
  );
}
