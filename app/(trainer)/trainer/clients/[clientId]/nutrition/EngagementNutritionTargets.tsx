"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewEngagementNutritionTargets,
  saveEngagementNutritionTargets,
  clearEngagementNutritionOverride,
} from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import type { GeneratedParameter } from "@/domains/parameters/types";
import type { NutritionOverride } from "@/domains/trainermealprogram/types";

type Preview = { calorieParameter: GeneratedParameter; proteinParameter: GeneratedParameter };

/**
 * Lets a trainer recompute daily calorie/protein targets scoped to this
 * assignment's own starts_on/end_date, instead of the client's flat
 * long-range generated_parameters calorie_target (2026-08-07, migration
 * 0084 -- a trainer's engagement window often doesn't match the client's
 * own goal timeline, e.g. a 13-week engagement inside a year-long goal).
 * Reuses the same deterministic engine and shows the same rationale/
 * assumptions/safety-bounds transparency the client sees for their own
 * targets on /plan/parameters, even though this value is scoped to just
 * this assignment and never touches the client's own record.
 */
export function EngagementNutritionTargets({
  clientId,
  startsOn,
  endDate,
  nutritionOverride,
}: {
  clientId: string;
  startsOn: string;
  endDate: string | null;
  nutritionOverride: NutritionOverride | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [calorieValue, setCalorieValue] = useState("");
  const [proteinValue, setProteinValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onRecalculate = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await previewEngagementNutritionTargets(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.data);
      setCalorieValue(String(result.data.calorieParameter.value));
      setProteinValue(String(result.data.proteinParameter.value));
    });
  };

  const onSave = () => {
    const calorieTarget = Number(calorieValue);
    const proteinTarget = Number(proteinValue);
    if (!(calorieTarget > 0) || !(proteinTarget > 0)) {
      setError("Enter valid positive numbers.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveEngagementNutritionTargets(clientId, calorieTarget, proteinTarget);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setPreview(null);
      router.refresh();
    });
  };

  const onClear = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await clearEngagementNutritionOverride(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (!endDate) {
    return (
      <p className="text-sm text-neutral-500">
        This assignment has no end date, so there&apos;s no engagement window to scope a target to.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        By default, portion recommendations use this client&apos;s own long-range calorie target. If your
        engagement ({startsOn} → {endDate}) doesn&apos;t match their overall goal timeline, recalculate a target
        scoped to just this window instead.
      </p>

      {nutritionOverride ? (
        <div className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <p className="font-medium">Currently used for this engagement</p>
          <p className="text-neutral-600 dark:text-neutral-400">
            {nutritionOverride.calorieTarget.toLocaleString()} cal/day ·{" "}
            {nutritionOverride.proteinTarget.toLocaleString()} g/day protein
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={onClear}
            className="mt-2 text-sm text-red-600 hover:underline"
            title="Go back to using this client's own approved calorie target instead."
          >
            Use client&apos;s own target instead
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          No engagement-scoped target yet — portion recommendations currently use this client&apos;s own
          approved target (or a 2,000-calorie placeholder if they don&apos;t have one).
        </p>
      )}

      {!preview ? (
        <Button type="button" variant="secondary" disabled={isPending} onClick={onRecalculate}>
          {isPending ? "Calculating…" : "Recalculate for this engagement"}
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Calorie target (daily)</span>
              <input
                type="number"
                min="1"
                value={calorieValue}
                onChange={(e) => setCalorieValue(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Protein target (daily)</span>
              <input
                type="number"
                min="1"
                value={proteinValue}
                onChange={(e) => setProteinValue(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
          </div>
          <div className="space-y-1 text-xs text-neutral-500">
            <p>{preview.calorieParameter.rationale}</p>
            <p>{preview.proteinParameter.rationale}</p>
            {preview.calorieParameter.assumptions.map((a) => (
              <p key={a}>Assumption: {a}</p>
            ))}
            {preview.calorieParameter.safetyBounds?.map((s) => (
              <p key={s} className="text-amber-600 dark:text-amber-400">
                {s}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={isPending} onClick={onSave}>
              {isPending ? "Saving…" : "Save as this engagement's target"}
            </Button>
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}
    </div>
  );
}
