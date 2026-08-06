"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClientDateOverride, clearClientDateOverride } from "@/domains/trainer/service";
import { SelectInput, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import type { ProjectedDay, ProjectedExercise } from "@/domains/trainerprogram/calendar-projection";
import type { OverrideExerciseInput } from "@/domains/trainerprogram/overrides";
import type { Exercise } from "@/domains/exerciselibrary/types";

type Row = {
  exerciseId: string;
  sets: string;
  repsMin: string;
  repsMax: string;
  intensityType: string;
  intensityValue: string;
  durationMinutes: string;
  cardioIntensity: string;
  coachingNotes: string;
};

function toRow(ex: ProjectedExercise): Row {
  return {
    exerciseId: ex.exerciseId,
    sets: ex.sets?.toString() ?? "",
    repsMin: ex.repsMin?.toString() ?? "",
    repsMax: ex.repsMax?.toString() ?? "",
    intensityType: ex.intensityType ?? "",
    intensityValue: ex.intensityValue ?? "",
    durationMinutes: ex.durationMinutes?.toString() ?? "",
    cardioIntensity: ex.cardioIntensity ?? "",
    coachingNotes: ex.coachingNotes ?? "",
  };
}

function toOverrideInput(r: Row): OverrideExerciseInput {
  return {
    exerciseId: r.exerciseId,
    sets: r.sets ? Number(r.sets) : null,
    repsMin: r.repsMin ? Number(r.repsMin) : null,
    repsMax: r.repsMax ? Number(r.repsMax) : null,
    intensityType: r.intensityType ? (r.intensityType as "percent_1rm" | "rpe" | "none") : null,
    intensityValue: r.intensityValue || null,
    durationMinutes: r.durationMinutes ? Number(r.durationMinutes) : null,
    cardioIntensity: r.cardioIntensity || null,
    coachingNotes: r.coachingNotes || null,
  };
}

const EMPTY_ROW: Row = {
  exerciseId: "",
  sets: "",
  repsMin: "",
  repsMax: "",
  intensityType: "",
  intensityValue: "",
  durationMinutes: "",
  cardioIntensity: "",
  coachingNotes: "",
};

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
  const [rows, setRows] = useState<Row[]>(day.exercises.length > 0 ? day.exercises.map(toRow) : []);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateRow = (index: number, next: Row) => {
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

          <label className="mb-3 flex items-center gap-2 text-sm">
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
                  <div className="flex items-center justify-between gap-2">
                    <SelectInput
                      value={row.exerciseId}
                      onChange={(e) => updateRow(index, { ...row, exerciseId: e.target.value })}
                      aria-label="Exercise"
                    >
                      <option value="">Pick an exercise…</option>
                      {exercises.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </SelectInput>
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <TextInput
                      type="number"
                      placeholder="Sets"
                      value={row.sets}
                      onChange={(e) => updateRow(index, { ...row, sets: e.target.value })}
                    />
                    <TextInput
                      type="number"
                      placeholder="Reps min"
                      value={row.repsMin}
                      onChange={(e) => updateRow(index, { ...row, repsMin: e.target.value })}
                    />
                    <TextInput
                      type="number"
                      placeholder="Reps max"
                      value={row.repsMax}
                      onChange={(e) => updateRow(index, { ...row, repsMax: e.target.value })}
                    />
                    <TextInput
                      type="number"
                      placeholder="Minutes"
                      value={row.durationMinutes}
                      onChange={(e) => updateRow(index, { ...row, durationMinutes: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SelectInput
                      value={row.intensityType}
                      onChange={(e) => updateRow(index, { ...row, intensityType: e.target.value })}
                      aria-label="Intensity type"
                    >
                      <option value="">No intensity target</option>
                      <option value="rpe">RPE</option>
                      <option value="percent_1rm">% of 1RM</option>
                    </SelectInput>
                    <TextInput
                      placeholder="Intensity value"
                      value={row.intensityValue}
                      onChange={(e) => updateRow(index, { ...row, intensityValue: e.target.value })}
                    />
                    <TextInput
                      placeholder="Cardio intensity"
                      value={row.cardioIntensity}
                      onChange={(e) => updateRow(index, { ...row, cardioIntensity: e.target.value })}
                    />
                  </div>
                  <TextArea
                    placeholder="Coaching notes (optional)"
                    rows={2}
                    value={row.coachingNotes}
                    onChange={(e) => updateRow(index, { ...row, coachingNotes: e.target.value })}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, EMPTY_ROW])}
                className="text-sm text-neutral-500 hover:underline"
              >
                + Add exercise
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" disabled={isPending} onClick={onSave}>
              {isPending ? "Saving…" : "Save"}
            </Button>
            {day.source === "override" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={onResetToTemplate}
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
