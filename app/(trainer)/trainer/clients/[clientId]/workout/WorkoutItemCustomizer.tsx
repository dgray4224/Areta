"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { customizeClientWorkoutItem } from "@/domains/trainer/service";
import { SelectInput, TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Exercise } from "@/domains/exerciselibrary/types";

/** Free-pick replace — see customizeClientWorkoutItem's doc comment for
 * why this isn't the curated "alternates" swap. */
export function WorkoutItemCustomizer({
  clientId,
  itemId,
  exercises,
}: {
  clientId: string;
  itemId: string;
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        Customize
      </button>
    );
  }

  const onSave = () => {
    if (!exerciseId) {
      setError("Pick a replacement exercise.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await customizeClientWorkoutItem(clientId, itemId, {
        exerciseId,
        sets: sets ? Number(sets) : null,
        reps: reps ? Number(reps) : null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800">
      <SelectInput value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} aria-label="Replacement exercise">
        <option value="">Pick a replacement…</option>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </SelectInput>
      <div className="grid grid-cols-3 gap-2">
        <TextInput type="number" placeholder="Sets" value={sets} onChange={(e) => setSets(e.target.value)} />
        <TextInput type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
        <TextInput
          type="number"
          placeholder="Minutes"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
