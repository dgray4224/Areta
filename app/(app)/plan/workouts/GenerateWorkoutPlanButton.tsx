"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateAndSaveWorkoutPlan } from "@/domains/workoutplan/service";

export function GenerateWorkoutPlanButton({
  userId,
  label = "Generate my workout plan",
}: {
  userId: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const onClick = () => {
    setError(null);
    setWarnings([]);
    startTransition(async () => {
      const result = await generateAndSaveWorkoutPlan(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWarnings(result.data.warnings);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Generating…" : label}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {warnings.map((w, i) => (
        <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
          {w}
        </p>
      ))}
    </div>
  );
}
