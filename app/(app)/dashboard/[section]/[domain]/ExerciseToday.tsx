"use client";

import { useState, useTransition } from "react";
import { Card } from "@/platform/ui/Card";
import { setWorkoutPlanItemCompleted, setWorkoutPlanItemNotes } from "@/domains/workoutplan/service";

export type PlannedExerciseView = {
  id: string;
  exerciseName: string;
  completedAt: string | null;
  notes: string | null;
  substituted: boolean;
  sets: number | null;
  reps: number | null;
  repsMin: number | null;
  repsMax: number | null;
  durationMinutes: number | null;
  intensityType: "percent_1rm" | "rpe" | "none" | null;
  intensityValue: string | null;
  cardioIntensity: string | null;
};

export type SyncedWorkoutView = { id: string; activityType: string; durationMinutes: number; caloriesBurned: number | null };

function formatPrescription(item: PlannedExerciseView): string {
  if (item.durationMinutes !== null && item.sets === null) {
    return item.cardioIntensity ? `${item.durationMinutes} min (${item.cardioIntensity})` : `${item.durationMinutes} min`;
  }
  const repsLabel =
    item.repsMin !== null && item.repsMax !== null
      ? item.repsMin === item.repsMax
        ? `${item.repsMin}`
        : `${item.repsMin}-${item.repsMax}`
      : item.reps !== null
        ? `${item.reps}`
        : "?";
  const intensitySuffix =
    item.intensityType === "rpe" && item.intensityValue
      ? ` @ RPE ${item.intensityValue}`
      : item.intensityType === "percent_1rm" && item.intensityValue
        ? ` @ ${item.intensityValue}%`
        : "";
  return `${item.sets ?? "?"} × ${repsLabel}${intensitySuffix}`;
}

function humanizeActivityType(activityType: string): string {
  const spaced = activityType.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The Dashboard exercise domain page's interactive core — a checkbox per
 * planned exercise ("did I follow today's plan," tracked independently
 * from HealthKit-synced workout_logs, shown read-only below) plus
 * per-exercise notes. Matches the interaction set areta-mobile's
 * Exercise.tsx has, minus swap/add-exercise/alternative-session/
 * scheduled-time editing — those need a full exercise-library picker UI
 * (mobile's ExercisePicker.tsx), a bigger lift deliberately deferred to
 * a later pass, same as the Plan panel's already-deferred interactivity.
 */
export function ExerciseToday({
  userId,
  plan,
  syncedWorkouts,
}: {
  userId: string;
  plan: PlannedExerciseView[];
  syncedWorkouts: SyncedWorkoutView[];
}) {
  const [items, setItems] = useState(plan);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const notesValue = (item: PlannedExerciseView) => notesDraft[item.id] ?? item.notes ?? "";

  const onToggle = (item: PlannedExerciseView) => {
    setTogglingId(item.id);
    startTransition(async () => {
      const result = await setWorkoutPlanItemCompleted(userId, item.id, !item.completedAt);
      setTogglingId(null);
      if (result.ok) {
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, completedAt: item.completedAt ? null : new Date().toISOString() } : p))
        );
      }
    });
  };

  const onSaveNotes = (item: PlannedExerciseView) => {
    const next = notesValue(item).trim();
    if (next === (item.notes ?? "")) {
      setExpandedId(null);
      return;
    }
    setSavingNotesId(item.id);
    startTransition(async () => {
      const result = await setWorkoutPlanItemNotes(userId, item.id, next || null);
      setSavingNotesId(null);
      if (result.ok) {
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, notes: next || null } : p)));
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-neutral-500">Today&apos;s workout</h2>
        <Card tone="surface" className="mt-2">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing planned for today.</p>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {items.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onToggle(item)}
                        disabled={isPending && togglingId === item.id}
                        aria-label={item.completedAt ? "Mark not done" : "Mark done"}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 ${
                          item.completedAt ? "border-accent bg-accent" : "border-neutral-300 dark:border-neutral-700"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${item.completedAt ? "text-neutral-400 line-through" : ""}`}>
                            {item.exerciseName}
                          </p>
                          {item.substituted ? (
                            <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:border-neutral-700">
                              swapped
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-neutral-500">{formatPrescription(item)}</p>
                        {!expanded && item.notes ? <p className="mt-0.5 text-xs italic text-neutral-500">{item.notes}</p> : null}
                        {expanded ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              autoFocus
                              value={notesValue(item)}
                              onChange={(e) => setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Add a note for today…"
                              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-card px-2 py-1 text-sm dark:border-neutral-700"
                            />
                            <button
                              type="button"
                              onClick={() => onSaveNotes(item)}
                              disabled={savingNotesId === item.id}
                              className="text-xs font-medium text-brand"
                            >
                              {savingNotesId === item.id ? "Saving…" : "Save"}
                            </button>
                            <button type="button" onClick={() => setExpandedId(null)} className="text-xs text-neutral-500">
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {!expanded ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(item.id)}
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
        <h2 className="text-sm font-medium text-neutral-500">Synced from Health</h2>
        <Card tone="surface" className="mt-2">
          {syncedWorkouts.length === 0 ? (
            <p className="text-sm text-neutral-500">No workouts synced yet today.</p>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {syncedWorkouts.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0">
                  <span>{humanizeActivityType(log.activityType)}</span>
                  <span className="text-neutral-500">
                    {log.durationMinutes} min
                    {log.caloriesBurned ? ` · ${Math.round(log.caloriesBurned)} kcal` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
