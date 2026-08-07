"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClientDateOverride, clearClientDateOverride } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import {
  ExercisePicker,
  EMPTY_PRESCRIPTION_FIELDS,
  prescriptionFieldsFrom,
  type PrescriptionFields,
} from "../../../../ExercisePicker";
import type { ProjectedDay } from "@/domains/trainerprogram/calendar-projection";
import type { OverrideExerciseInput } from "@/domains/trainerprogram/overrides";
import type { Exercise } from "@/domains/exerciselibrary/types";

function toOverrideInput(f: PrescriptionFields): OverrideExerciseInput {
  const reps = f.reps ? Number(f.reps) : null;
  return {
    exerciseId: f.exerciseId,
    sets: f.sets ? Number(f.sets) : null,
    repsMin: reps,
    repsMax: reps,
    intensityType: f.intensityType ? (f.intensityType as "percent_1rm" | "rpe" | "none") : null,
    intensityValue: f.intensityValue || null,
    durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : null,
    cardioIntensity: f.cardioIntensity || null,
    coachingNotes: f.coachingNotes || null,
  };
}

export function DayEditorPanel({
  clientId,
  day,
  exercises,
  onClose,
}: {
  clientId: string;
  day: ProjectedDay;
  exercises: Exercise[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isRestDay, setIsRestDay] = useState(day.exercises.length === 0);
  const [rows, setRows] = useState<PrescriptionFields[]>(
    day.exercises.length > 0 ? day.exercises.map(prescriptionFieldsFrom) : []
  );
  const [exerciseList, setExerciseList] = useState(exercises);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateRow = (index: number, next: PrescriptionFields) => {
    setRows((prev) => prev.map((r, i) => (i === index ? next : r)));
  };

  const onSave = () => {
    if (!isRestDay && rows.some((r) => !r.exerciseId)) {
      setError("Every exercise needs one picked, or remove the empty row.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setClientDateOverride(clientId, day.date, {
        isRestDay,
        exercises: isRestDay ? [] : rows.map(toOverrideInput),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const onResetToTemplate = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearClientDateOverride(clientId, day.date);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">{day.date}</p>
            <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:underline">
              Close
            </button>
          </div>

          <label className="mb-3 flex items-center gap-2 text-sm" title="Marks this date as a rest day, replacing whatever the recurring schedule or a previous edit had.">
            <input
              type="checkbox"
              checked={isRestDay}
              onChange={(e) => {
                setIsRestDay(e.target.checked);
                if (e.target.checked) setRows([]);
              }}
            />
            Rest day
          </label>

          {!isRestDay ? (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <ExercisePicker
                        fields={row}
                        setFields={(next) => updateRow(index, next)}
                        exercises={exerciseList}
                        onExerciseCreated={(ex) => setExerciseList((prev) => [...prev, ex])}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, EMPTY_PRESCRIPTION_FIELDS])}
                className="text-sm text-neutral-500 hover:underline"
              >
                + Add exercise
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={onSave}
              title="Saves this date only -- doesn't change the recurring template."
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
            {day.source === "override" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={onResetToTemplate}
                title="Discards this date's custom content and goes back to whatever the recurring schedule says."
                className="text-sm text-neutral-500 hover:underline"
              >
                Reset to template
              </button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
