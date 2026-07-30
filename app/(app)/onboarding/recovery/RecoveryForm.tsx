"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { recoverySchema, type RecoveryInput } from "@/domains/recovery/schema";
import { saveRecoveryStep, skipRecoveryStep } from "@/domains/recovery/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";

export function RecoveryForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
  backHref,
}: {
  userId: string;
  defaultValues: RecoveryInput;
  stepIndex: number;
  totalSteps: number;
  backHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryInput>({
    resolver: zodResolver(recoverySchema),
    defaultValues,
  });

  const onSubmit = (values: RecoveryInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveRecoveryStep(userId, { ...values, skipped: false });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding");
    });
  };

  const onSkip = () => {
    setServerError(null);
    startTransition(async () => {
      const result = await skipRecoveryStep(userId);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding");
    });
  };

  return (
    <StepShell
      title="Recovery (optional)"
      description="If you're managing an injury or surgery recovery, Areta can organize your clinician's instructions — it will never invent medical guidance."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Surgery or injury date" htmlFor="injuryOrSurgeryDate">
          <TextInput id="injuryOrSurgeryDate" type="date" {...register("injuryOrSurgeryDate")} />
        </FormField>
        <FormField label="Current phase" htmlFor="currentPhase" hint="As described by your clinician">
          <TextInput id="currentPhase" {...register("currentPhase")} />
        </FormField>
        <FormField label="Clinician instructions" htmlFor="clinicianInstructions">
          <TextArea id="clinicianInstructions" {...register("clinicianInstructions")} />
        </FormField>
        <FormField label="Current restrictions" htmlFor="restrictions">
          <TextArea id="restrictions" {...register("restrictions")} />
        </FormField>
        <FormField label="Mobility" htmlFor="mobility">
          <TextInput id="mobility" {...register("mobility")} />
        </FormField>
        <FormField label="Physical therapy schedule" htmlFor="physicalTherapySchedule">
          <TextInput id="physicalTherapySchedule" {...register("physicalTherapySchedule")} />
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("trackPainAndSwelling")} />
          Track pain and swelling daily
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" {...register("warningSignsAcknowledged")} />
          <span>
            I understand Areta will prompt me to contact my care team or emergency services for
            warning signs, and will never advance my recovery protocol on its own.
          </span>
        </label>
        {errors.warningSignsAcknowledged ? (
          <p className="text-sm text-red-600">{errors.warningSignsAcknowledged.message}</p>
        ) : null}

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {isPending ? "Saving…" : "Continue"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={isPending}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300"
          >
            Not applicable
          </button>
        </div>
      </form>
    </StepShell>
  );
}
