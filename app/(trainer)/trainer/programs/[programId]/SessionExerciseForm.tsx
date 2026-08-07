"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSessionExercise, updateSessionExercise, deleteSessionExercise } from "@/domains/trainerprogram/service";
import { Button } from "@/platform/ui/Button";
import { ExercisePicker, EMPTY_PRESCRIPTION_FIELDS, prescriptionFieldsFrom, type PrescriptionFields } from "../../ExercisePicker";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { TrainerProgramSessionExercise } from "@/domains/trainerprogram/types";

function toInput(f: PrescriptionFields) {
  const reps = f.reps ? Number(f.reps) : undefined;
  return {
    exerciseId: f.exerciseId,
    sets: f.sets ? Number(f.sets) : undefined,
    repsMin: reps,
    repsMax: reps,
    intensityType: f.intensityType ? (f.intensityType as "percent_1rm" | "rpe" | "none") : undefined,
    intensityValue: f.intensityValue || undefined,
    durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : undefined,
    cardioIntensity: f.cardioIntensity || undefined,
    coachingNotes: f.coachingNotes || undefined,
  };
}

export function AddSessionExerciseForm({ sessionId, exercises }: { sessionId: string; exercises: Exercise[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<PrescriptionFields>(EMPTY_PRESCRIPTION_FIELDS);
  const [exerciseList, setExerciseList] = useState(exercises);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        + Add exercise
      </button>
    );
  }

  const onSave = () => {
    if (!fields.exerciseId) {
      setError("Pick an exercise.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addSessionExercise(sessionId, toInput(fields));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFields(EMPTY_PRESCRIPTION_FIELDS);
      router.refresh();
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <ExercisePicker
        fields={fields}
        setFields={setFields}
        exercises={exerciseList}
        onExerciseCreated={(ex) => setExerciseList((prev) => [...prev, ex])}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Add"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SessionExerciseRow({
  item,
  exercises,
  exerciseName,
}: {
  item: TrainerProgramSessionExercise;
  exercises: Exercise[];
  exerciseName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<PrescriptionFields>(() => prescriptionFieldsFrom(item));
  const [exerciseList, setExerciseList] = useState(exercises);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    if (!fields.exerciseId) {
      setError("Pick an exercise.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSessionExercise(item.id, toInput(fields));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm("Remove this exercise from the session?")) return;
    startTransition(async () => {
      const result = await deleteSessionExercise(item.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (!editing) {
    const repsLabel = item.repsMax ?? item.repsMin;
    const intensity =
      item.intensityType === "rpe" && item.intensityValue
        ? ` @ RPE ${item.intensityValue}`
        : item.intensityType === "percent_1rm" && item.intensityValue
          ? ` @ ${item.intensityValue}%`
          : "";
    return (
      <li className="text-sm text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center justify-between">
          <span>
            {exerciseName}
            {item.durationMinutes !== null && item.repsMin === null
              ? ` — ${item.durationMinutes} min${item.cardioIntensity ? ` (${item.cardioIntensity})` : ""}`
              : ` — ${item.sets ?? "?"} × ${repsLabel ?? "?"}${intensity}`}
          </span>
          <span className="flex gap-2 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="hover:underline">
              Edit
            </button>
            <button type="button" onClick={onDelete} disabled={isPending} className="text-red-600 hover:underline">
              Remove
            </button>
          </span>
        </div>
        {item.coachingNotes ? <p className="mt-0.5 text-xs italic text-neutral-500">{item.coachingNotes}</p> : null}
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <ExercisePicker
        fields={fields}
        setFields={setFields}
        exercises={exerciseList}
        onExerciseCreated={(ex) => setExerciseList((prev) => [...prev, ex])}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </li>
  );
}
