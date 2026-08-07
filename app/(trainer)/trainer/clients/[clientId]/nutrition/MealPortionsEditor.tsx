"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getMealPortionRecommendations, saveMealPortions } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import type { MealPortionRow } from "@/domains/trainermealprogram/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"];

/**
 * Per-client portion review for the assignment's current phase (2026-08-07,
 * user feedback: "the trainer should manually tailor portion sizes to the
 * specific client... we can help by recommending appropriate portions
 * based on the client's targets"). Every row starts at either what the
 * trainer already saved for this client, or a live-computed recommendation
 * (domains/trainermealprogram/portion-recommendation.ts) if they haven't --
 * never a value silently baked into the program itself, since portion size
 * is deliberately per-client, not per-program (migration 0083's own
 * comment explains why).
 */
export function MealPortionsEditor({ clientId, phaseId }: { clientId: string; phaseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [rows, setRows] = useState<MealPortionRow[]>([]);
  const [servingsById, setServingsById] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // No setLoading(true) here: this component fully unmounts/remounts each
    // time the parent's "Edit portions" toggle flips (it's gated behind
    // editingPortions in AssignedMealProgramPanel), so useState(true)'s
    // initial value already covers it -- calling it again synchronously in
    // the effect body just trips react-hooks/set-state-in-effect for no
    // benefit.
    let cancelled = false;
    getMealPortionRecommendations(clientId, phaseId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCalorieTarget(result.data.calorieTarget);
      setRows(result.data.rows);
      const initial: Record<string, string> = {};
      for (const row of result.data.rows) {
        initial[row.programMealId] = String(row.savedServings ?? row.recommendedServings);
      }
      setServingsById(initial);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, phaseId]);

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const portions = rows
        .map((row) => ({ programMealId: row.programMealId, servings: Number(servingsById[row.programMealId]) }))
        .filter((p) => p.servings > 0);
      const result = await saveMealPortions(clientId, portions);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        This phase has no meals yet — add some in the program builder first.
      </p>
    );
  }

  const byDay = new Map<number, MealPortionRow[]>();
  for (const row of rows) {
    const arr = byDay.get(row.dayOfWeek) ?? [];
    arr.push(row);
    byDay.set(row.dayOfWeek, arr);
  }
  const days = Array.from(byDay.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {calorieTarget
          ? `Recommended servings are based on this client's approved ${calorieTarget}-calorie target, split across each day's meals. Adjust any number, then save.`
          : "This client doesn't have an approved calorie target yet, so the recommendations below use a generic 2,000-calorie placeholder — adjust freely, or have them approve their real target first for a better starting point."}
      </p>
      {days.map((day) => {
        const dayRows = (byDay.get(day) ?? [])
          .slice()
          .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType));
        return (
          <div key={day} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="mb-2 text-sm font-medium">{DAY_NAMES[day]}</p>
            <ul className="space-y-2">
              {dayRows.map((row) => {
                const servings = Number(servingsById[row.programMealId]) || 0;
                return (
                  <li key={row.programMealId} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium">{row.recipeName}</span>
                      <span className="ml-2 text-xs capitalize text-neutral-500">{row.mealType}</span>
                      <p className="text-xs text-neutral-500">
                        {Math.round(row.baseCalories * servings)} cal · {Math.round(row.baseProteinG * servings)}g
                        protein at {servings}x{row.savedServings === null ? " (recommended)" : ""}
                      </p>
                    </div>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      aria-label={`Servings for ${row.recipeName}`}
                      value={servingsById[row.programMealId] ?? ""}
                      onChange={(e) => setServingsById((prev) => ({ ...prev, [row.programMealId]: e.target.value }))}
                      className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}
      <Button type="button" disabled={isPending} onClick={onSave}>
        {isPending ? "Saving…" : "Save portions"}
      </Button>
    </div>
  );
}
