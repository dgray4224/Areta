"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmOnboarding } from "@/domains/onboarding/orchestrator";
import type { OnboardingOutput, OnboardingResponses } from "@/domains/onboarding/types";
import { DOMAIN_LABELS } from "@/domains/goals/schema";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";

const CHECKIN_FIELD_OPTIONS = ["weight", "sleep", "nutrition", "recovery", "learning"];

export function ReviewForm({
  userId,
  responses,
  initialOutput,
  stepIndex,
  totalSteps,
  backHref,
}: {
  userId: string;
  responses: OnboardingResponses;
  initialOutput: OnboardingOutput;
  stepIndex: number;
  totalSteps: number;
  backHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [output, setOutput] = useState<OnboardingOutput>(initialOutput);

  const updatePhase = (index: number, patch: Partial<OnboardingOutput["currentPhases"][number]>) => {
    setOutput((prev) => ({
      ...prev,
      currentPhases: prev.currentPhases.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  const updateWeeklyOutcome = (index: number, outcomeText: string) => {
    setOutput((prev) => ({
      ...prev,
      initialWeeklyOutcomes: prev.initialWeeklyOutcomes.map((o, i) =>
        i === index ? { ...o, outcomeText } : o
      ),
    }));
  };

  const toggleCheckinField = (field: string) => {
    setOutput((prev) => ({
      ...prev,
      dailyCheckinFields: prev.dailyCheckinFields.includes(field)
        ? prev.dailyCheckinFields.filter((f) => f !== field)
        : [...prev.dailyCheckinFields, field],
    }));
  };

  const onConfirm = () => {
    setServerError(null);
    startTransition(async () => {
      const result = await confirmOnboarding(userId, responses, output);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <StepShell
      title="Review your plan"
      description="Edit anything before it becomes active."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    >
      <div className="space-y-6">
        <FormField label="Mission" htmlFor="mission">
          <TextArea
            id="mission"
            value={output.mission}
            onChange={(e) => setOutput((prev) => ({ ...prev, mission: e.target.value }))}
          />
        </FormField>

        <div>
          <p className="text-sm font-medium">Active domains</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {output.activeDomains.map((d) => (
              <span
                key={d}
                className="rounded-full bg-neutral-200 px-3 py-1 text-xs dark:bg-neutral-800"
              >
                {DOMAIN_LABELS[d] ?? d}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ranked goals</p>
            <Link href="/onboarding/goals" className="text-xs text-neutral-500 hover:underline">
              Edit goals
            </Link>
          </div>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {output.rankedGoals.map((g, i) => (
              <li key={i}>
                {g.outcome}
                {g.targetDate ? ` — by ${g.targetDate}` : ""}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Current phases</p>
          {output.currentPhases.map((phase, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <FormField label="Name" htmlFor={`phase-name-${i}`}>
                <TextInput
                  id={`phase-name-${i}`}
                  value={phase.name}
                  onChange={(e) => updatePhase(i, { name: e.target.value })}
                />
              </FormField>
              <FormField label="Mission" htmlFor={`phase-mission-${i}`}>
                <TextInput
                  id={`phase-mission-${i}`}
                  value={phase.mission}
                  onChange={(e) => updatePhase(i, { mission: e.target.value })}
                />
              </FormField>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Initial weekly outcomes</p>
          {output.initialWeeklyOutcomes.map((outcome, i) => (
            <FormField key={i} label={outcome.goalOutcome} htmlFor={`weekly-outcome-${i}`}>
              <TextInput
                id={`weekly-outcome-${i}`}
                value={outcome.outcomeText}
                onChange={(e) => updateWeeklyOutcome(i, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        <div>
          <p className="text-sm font-medium">Daily check-in fields</p>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {CHECKIN_FIELD_OPTIONS.map((field) => (
              <label key={field} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={output.dailyCheckinFields.includes(field)}
                  onChange={() => toggleCheckinField(field)}
                />
                {field}
              </label>
            ))}
          </div>
        </div>

        {output.knownConstraints.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Known constraints</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
              {output.knownConstraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Coaching preferences</p>
            <Link href="/settings/personalization" className="text-xs text-neutral-500 hover:underline">
              Edit
            </Link>
          </div>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {output.initialPersonalizationProfile.tone} tone,{" "}
            {output.initialPersonalizationProfile.planningStyle} planning,{" "}
            {output.initialPersonalizationProfile.reminderPreference} reminders
          </p>
        </div>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isPending ? "Activating…" : "Approve and activate"}
        </button>
      </div>
    </StepShell>
  );
}
