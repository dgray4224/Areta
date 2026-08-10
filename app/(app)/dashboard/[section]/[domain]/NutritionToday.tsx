"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { setMealPlanItemCompleted, setMealPlanItemNotes } from "@/domains/mealplan/service";
import { logNutrition } from "@/domains/nutrition/log-service";
import type { NutritionLogInput } from "@/domains/nutrition/log-schema";

export type PlannedMealView = {
  id: string;
  recipeName: string;
  cuisine: string | null;
  photoUrl: string | null;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  completedAt: string | null;
  notes: string | null;
};

export type LoggedFoodView = {
  id: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  food: string;
  quantity: number | null;
  unit: string | null;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const UNIT_OPTIONS = ["g", "oz", "cup", "tbsp", "tsp", "ml", "serving", "piece"];

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

function macroSummary(log: LoggedFoodView): string {
  const parts: string[] = [];
  if (log.calories != null) parts.push(`${log.calories} kcal`);
  if (log.protein != null) parts.push(`${roundTo1(log.protein)}g protein`);
  if (log.carbohydrates != null) parts.push(`${roundTo1(log.carbohydrates)}g carbs`);
  if (log.fat != null) parts.push(`${roundTo1(log.fat)}g fat`);
  return parts.join(" · ");
}

/** Sorted-into-a-Set dedupe, most-recent-first, capped — same shape as
 * areta-mobile's Nutrition.tsx dedupeFoodNames. */
function dedupeFoodNames(names: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * The Dashboard nutrition domain page's interactive core — a checkbox per
 * planned meal ("ate this as planned", captures the recipe's known macros
 * server-side) plus a freeform off-plan log form below, matching
 * areta-mobile's Nutrition.tsx. Barcode scanning is deliberately not
 * ported (camera-only, N/A on web); everything else mobile's tab does is
 * here: recent-foods autocomplete, a snack nudge when nothing's planned,
 * collapsible quantity/unit/macro details, per-meal notes.
 */
export function NutritionToday({
  userId,
  date,
  initialPlan,
  initialLogs,
  recentFoodNames,
}: {
  userId: string;
  date: string;
  initialPlan: PlannedMealView[];
  initialLogs: LoggedFoodView[];
  recentFoodNames: string[];
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [logs, setLogs] = useState(initialLogs);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [meal, setMeal] = useState<(typeof MEAL_TYPES)[number]>("breakfast");
  const [food, setFood] = useState("");
  const [calories, setCalories] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("oz");
  const [protein, setProtein] = useState("");
  const [carbohydrates, setCarbohydrates] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasSnackPlanned = plan.some((item) => item.mealType === "snack");
  const foodSuggestions = dedupeFoodNames([...logs.map((l) => l.food), ...recentFoodNames], 8);

  const onToggle = (item: PlannedMealView) => {
    setTogglingId(item.id);
    startTransition(async () => {
      const result = await setMealPlanItemCompleted(userId, item.id, !item.completedAt);
      setTogglingId(null);
      if (result.ok) {
        setPlan((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, completedAt: item.completedAt ? null : new Date().toISOString() } : p))
        );
      }
    });
  };

  const onSaveNote = (itemId: string) => {
    setSavingNoteId(itemId);
    startTransition(async () => {
      const result = await setMealPlanItemNotes(userId, itemId, noteDraft.trim() || null);
      setSavingNoteId(null);
      if (result.ok) {
        setPlan((prev) => prev.map((p) => (p.id === itemId ? { ...p, notes: noteDraft.trim() || null } : p)));
        setNoteEditingId(null);
        setNoteDraft("");
      }
    });
  };

  const resetLogForm = () => {
    setFood("");
    setCalories("");
    setQuantity("");
    setUnit("oz");
    setProtein("");
    setCarbohydrates("");
    setFat("");
    setFiber("");
    setLogNotes("");
    setShowDetails(false);
  };

  const onLogFood = (e: FormEvent) => {
    e.preventDefault();
    if (!food.trim()) return;
    setSubmitting(true);
    setFormError(null);
    const input: NutritionLogInput = {
      date,
      meal,
      food: food.trim(),
      quantity: quantity ? Number(quantity) : undefined,
      unit: unit.trim() || undefined,
      calories: calories ? Number(calories) : undefined,
      protein: protein ? Number(protein) : undefined,
      carbohydrates: carbohydrates ? Number(carbohydrates) : undefined,
      fat: fat ? Number(fat) : undefined,
      fiber: fiber ? Number(fiber) : undefined,
      notes: logNotes.trim() || undefined,
    };
    startTransition(async () => {
      const result = await logNutrition(userId, input);
      setSubmitting(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setLogs((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          meal: input.meal,
          food: input.food,
          quantity: input.quantity ?? null,
          unit: input.unit ?? null,
          calories: input.calories ?? null,
          protein: input.protein ?? null,
          carbohydrates: input.carbohydrates ?? null,
          fat: input.fat ?? null,
          fiber: input.fiber ?? null,
        },
      ]);
      resetLogForm();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-neutral-500">Today&apos;s meals</h2>
        {!hasSnackPlanned && plan.length > 0 ? (
          <button
            type="button"
            onClick={() => setMeal("snack")}
            className="mt-1 text-xs font-semibold text-brand hover:underline"
          >
            No snack planned today — log one below
          </button>
        ) : null}
        <Card tone="surface" className="mt-2">
          {plan.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing planned for today.</p>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {plan.map((item) => {
                const editingNote = noteEditingId === item.id;
                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onToggle(item)}
                        disabled={isPending && togglingId === item.id}
                        aria-label={item.completedAt ? "Mark not eaten" : "Mark eaten"}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 ${
                          item.completedAt ? "border-accent bg-accent" : "border-neutral-300 dark:border-neutral-700"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${item.completedAt ? "text-neutral-400 line-through" : ""}`}>
                          {item.recipeName}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {item.mealType}
                          {item.cuisine ? ` · ${item.cuisine}` : ""} · {item.servings} serving{item.servings === 1 ? "" : "s"}
                        </p>
                        {!editingNote && item.notes ? <p className="mt-0.5 text-xs italic text-neutral-500">{item.notes}</p> : null}
                        {editingNote ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              autoFocus
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Note (e.g. swap for chicken, half portion)"
                              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-card px-2 py-1 text-sm dark:border-neutral-700"
                            />
                            <button
                              type="button"
                              onClick={() => onSaveNote(item.id)}
                              disabled={savingNoteId === item.id}
                              className="text-xs font-medium text-brand"
                            >
                              {savingNoteId === item.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNoteEditingId(null);
                                setNoteDraft("");
                              }}
                              className="text-xs text-neutral-500"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {!editingNote ? (
                        <button
                          type="button"
                          onClick={() => {
                            setNoteEditingId(item.id);
                            setNoteDraft(item.notes ?? "");
                          }}
                          className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-black/[0.03] dark:border-neutral-700 dark:hover:bg-white/5"
                        >
                          {item.notes ? "Edit" : "+ Note"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-medium text-neutral-500">Log something off-plan</h2>
        <Card tone="surface" className="mt-2">
          <form onSubmit={onLogFood} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeal(m)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${
                    meal === m
                      ? "border-brand bg-brand text-brand-ink"
                      : "border-neutral-300 text-neutral-600 hover:bg-black/[0.03] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <input
              value={food}
              onChange={(e) => setFood(e.target.value)}
              placeholder="What did you eat?"
              className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
            />
            {foodSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {foodSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setFood(name)}
                    className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-black/[0.03] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}

            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="Calories (optional)"
              className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
            />

            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="text-xs font-semibold text-brand"
            >
              {showDetails ? "Hide details" : "Add details (quantity, macros, notes)"}
            </button>

            {showDetails ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Quantity"
                    className="rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    placeholder="Protein (g)"
                    className="rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  />
                  <input
                    type="number"
                    value={carbohydrates}
                    onChange={(e) => setCarbohydrates(e.target.value)}
                    placeholder="Carbs (g)"
                    className="rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    placeholder="Fat (g)"
                    className="rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  />
                  <input
                    type="number"
                    value={fiber}
                    onChange={(e) => setFiber(e.target.value)}
                    placeholder="Fiber (g)"
                    className="rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  />
                </div>
                <input
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                />
              </div>
            ) : null}

            {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}

            <button
              type="submit"
              disabled={submitting || !food.trim()}
              className="w-full rounded-md bg-brand-fill px-3 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
            >
              {submitting ? "Logging…" : "Log it"}
            </button>
          </form>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-medium text-neutral-500">Logged today</h2>
        <Card tone="surface" className="mt-2">
          {logs.length === 0 ? (
            <EmptyState title="Nothing logged yet today" />
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {logs.map((log) => {
                const macros = macroSummary(log);
                return (
                  <div key={log.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm">
                      <span className="capitalize">{log.meal}</span>: {log.food}
                      {log.quantity ? ` (${log.quantity}${log.unit ? ` ${log.unit}` : ""})` : ""}
                    </p>
                    {macros ? <p className="text-xs text-neutral-500">{macros}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
