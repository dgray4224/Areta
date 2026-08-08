"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generatePlansAfterOnboarding,
  type GeneratePlansResult,
  type PlanReadiness,
} from "@/domains/onboarding/generate-plans";

/**
 * The post-onboarding "want your plans generated?" prompt (2026-08-07):
 * replaces sending a fresh user to /plan/setup's 4-generate + 4-approve
 * walk. Shown as a modal right after onboarding confirms; readiness
 * (which plans have enough inputs) was fetched alongside the confirm so
 * the prompt warns about anything missing instead of failing after the
 * fact. One tap generates + activates both plans; "Not now" just goes
 * to the dashboard, and /plan keeps working as before either way.
 */
export function PlanSetupPrompt({ userId, readiness }: { userId: string; readiness: PlanReadiness }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GeneratePlansResult | null>(null);

  const missing = [
    ...(!readiness.nutrition.ready ? readiness.nutrition.missingInputs : []),
    ...(!readiness.workout.ready ? readiness.workout.missingInputs : []),
  ];
  const anyReady = readiness.nutrition.ready || readiness.workout.ready;

  const onGenerate = () => {
    startTransition(async () => {
      setResult(await generatePlansAfterOnboarding(userId));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        {result === null ? (
          <>
            <h2 className="text-lg font-semibold">You&apos;re all set — want your plans ready too?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Areta can generate your nutrition targets, weekly meal plan (with grocery list and prep
              plan), and workout plan from your answers right now, and load them straight into your
              account.
            </p>
            {missing.length > 0 ? (
              <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Heads up — some answers are missing: {missing.join(", ")}.{" "}
                {anyReady
                  ? "The plans that have enough information will still generate; add the rest in Settings later for the others."
                  : "Add them from Settings → Profile (or redo the relevant onboarding step) and generate from the Plan page afterwards."}
              </p>
            ) : null}
            <div className="mt-5 flex gap-3">
              {anyReady ? (
                <button
                  onClick={onGenerate}
                  disabled={isPending}
                  className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {isPending ? "Generating…" : "Generate my plans"}
                </button>
              ) : null}
              <button
                onClick={() => router.push("/dashboard")}
                disabled={isPending}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">
              {result.nutrition.ok && result.workout.ok ? "Your plans are ready" : "Partially done"}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                {result.nutrition.ok
                  ? "✓ Nutrition: targets, meal plan, grocery list, and prep plan are live."
                  : `✕ Nutrition: ${result.nutrition.error}`}
              </li>
              <li>
                {result.workout.ok
                  ? "✓ Workout: your weekly training plan is live."
                  : `✕ Workout: ${result.workout.error}`}
              </li>
            </ul>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Go to my dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
