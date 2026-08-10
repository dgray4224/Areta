"use client";

import { useState, useTransition } from "react";
import { Card } from "@/platform/ui/Card";
import { ExercisePicker, type ExerciseScheme } from "@/platform/ui/ExercisePicker";
import {
  setWorkoutPlanItemCompleted,
  setWorkoutPlanItemNotes,
  customizeWorkoutPlanItemExercise,
  addWorkoutPlanItemExercise,
  type WorkoutPlanItemView,
} from "@/domains/workoutplan/service";
import type { Exercise } from "@/domains/exerciselibrary/types";

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

/** Server actions return WorkoutPlanItemView (has exerciseId, not a
 * resolved name) — look the name up from the same library array the
 * picker itself browses, already loaded client-side, rather than a
 * second round trip. */
function toPlannedView(item: WorkoutPlanItemView, exercises: Exercise[]): PlannedExerciseView {
  return {
    id: item.id,
    exerciseName: exercises.find((e) => e.id === item.exerciseId)?.name ?? "Unknown exercise",
    completedAt: item.completedAt,
    notes: item.notes,
    substituted: item.substituted,
    sets: item.sets,
    reps: item.reps,
    repsMin: item.repsMin,
    repsMax: item.repsMax,
    durationMinutes: item.durationMinutes,
    intensityType: item.intensityType,
    intensityValue: item.intensityValue,
    cardioIntensity: item.cardioIntensity,
  };
}

/**
 * The Dashboard exercise domain page's interactive core — a checkbox per
 * planned exercise ("did I follow today's plan," tracked independently
 * from HealthKit-synced workout_logs, shown read-only below), per-
 * exercise notes, and swap/add via ExercisePicker (platform/ui/
 * ExercisePicker.tsx). Matches the interaction set areta-mobile's
 * Exercise.tsx has, minus alternative-session switching and scheduled-
 * time editing (program-level / drag-timeline concepts, out of scope
 * here) — free-library swap and add-exercise are covered.
 */
export function ExerciseToday({
  userId,
  dayOfWeek,
  plan,
  exercises,
  syncedWorkouts,
}: {
  userId: string;
  dayOfWeek: number;
  plan: PlannedExerciseView[];
  exercises: Exercise[];
  syncedWorkouts: SyncedWorkoutView[];
}) {
  const [items, setItems] = useState(plan);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"swap" | "add" | null>(null);
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  // Bumped on every open — see ExercisePicker.tsx's own doc comment on
  // why it needs a fresh `key` per session rather than resetting itself.
  const [pickerSessionId, setPickerSessionId] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const notesValue = (item: PlannedExerciseView) => notesDraft[item.id] ?? item.notes ?? "";
  const pickerItem = items.find((i) => i.id === pickerItemId) ?? null;

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

  const openSwapPicker = (itemId: string) => {
    setPickerError(null);
    setPickerMode("swap");
    setPickerItemId(itemId);
    setPickerSessionId((n) => n + 1);
  };

  const openAddPicker = () => {
    setPickerError(null);
    setPickerMode("add");
    setPickerItemId(null);
    setPickerSessionId((n) => n + 1);
  };

  const closePicker = () => {
    setPickerMode(null);
    setPickerItemId(null);
  };

  const onConfirmPicker = (exerciseId: string, scheme: ExerciseScheme) => {
    setConfirming(true);
    setPickerError(null);
    startTransition(async () => {
      if (pickerMode === "swap" && pickerItemId) {
        const result = await customizeWorkoutPlanItemExercise(userId, pickerItemId, { exerciseId, ...scheme });
        setConfirming(false);
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setItems((prev) => prev.map((p) => (p.id === pickerItemId ? toPlannedView(result.data, exercises) : p)));
        closePicker();
      } else if (pickerMode === "add") {
        const result = await addWorkoutPlanItemExercise(userId, dayOfWeek, { exerciseId, ...scheme });
        setConfirming(false);
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setItems((prev) => [...prev, toPlannedView(result.data, exercises)]);
        closePicker();
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
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => openSwapPicker(item.id)}
                            aria-label="Swap exercise"
                            className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-black/[0.03] dark:border-neutral-700 dark:hover:bg-white/5"
                          >
                            ⇄
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedId(item.id)}
                            className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-black/[0.03] dark:border-neutral-700 dark:hover:bg-white/5"
                          >
                            {item.notes ? "Edit" : "+ Note"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={openAddPicker}
            className="mt-3 w-full rounded-lg border border-dashed border-neutral-300 py-2 text-sm font-medium text-brand hover:bg-black/[0.02] dark:border-neutral-700 dark:hover:bg-white/5"
          >
            + Add exercise
          </button>
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

      <ExercisePicker
        key={pickerSessionId}
        open={pickerMode !== null}
        mode={pickerMode ?? "add"}
        exercises={exercises}
        currentScheme={
          pickerItem
            ? { sets: pickerItem.sets, reps: pickerItem.reps, durationMinutes: pickerItem.durationMinutes }
            : undefined
        }
        onClose={closePicker}
        onConfirm={onConfirmPicker}
        confirming={confirming}
      />
      {pickerError ? <p className="text-sm text-red-600 dark:text-red-400">{pickerError}</p> : null}
    </div>
  );
}
