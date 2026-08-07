"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePhase } from "@/domains/trainerprogram/service";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import { DeletePhaseButton } from "./DeletePhaseButton";
import type { TrainerProgramPhase } from "@/domains/trainerprogram/types";

/** View + in-place edit for a phase's own name/focus/length/final flag --
 * only a delete option existed until 2026-08-06, no way to fix a typo
 * without deleting and recreating the phase (which would also orphan its
 * sessions/exercises). Same "row replaces itself with the edit form"
 * pattern as SessionExerciseForm.tsx's SessionExerciseRow, rather than
 * squeezing the form into the header's small button corner. */
export function PhaseHeader({ phase, phaseNumber }: { phase: TrainerProgramPhase; phaseNumber: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(phase.name);
  const [focus, setFocus] = useState(phase.focus ?? "");
  const [lengthWeeks, setLengthWeeks] = useState(phase.lengthWeeks.toString());
  const [isFinal, setIsFinal] = useState(phase.isFinal);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updatePhase(phase.id, { name, focus, lengthWeeks: Number(lengthWeeks), isFinal });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="mb-3 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <FormField label="Phase name" htmlFor={`edit-phase-name-${phase.id}`}>
          <TextInput id={`edit-phase-name-${phase.id}`} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField
          label="Focus"
          htmlFor={`edit-phase-focus-${phase.id}`}
          hint="Optional — shows on the client's plan."
        >
          <TextArea
            id={`edit-phase-focus-${phase.id}`}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            rows={2}
          />
        </FormField>
        <FormField
          label="Length (weeks)"
          htmlFor={`edit-phase-weeks-${phase.id}`}
          hint="Every week in this phase is the same."
        >
          <TextInput
            id={`edit-phase-weeks-${phase.id}`}
            type="number"
            min={1}
            value={lengthWeeks}
            onChange={(e) => setLengthWeeks(e.target.value)}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />
          This is the last phase in the program
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" disabled={isPending || !name} onClick={onSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-start justify-between">
      <div>
        <p className="font-medium">
          Phase {phaseNumber}: {phase.name}
          {phase.isFinal ? (
            <span className="ml-2 rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 dark:border-neutral-700">
              Final
            </span>
          ) : null}
        </p>
        {phase.focus ? <p className="text-sm text-neutral-500">{phase.focus}</p> : null}
        <p className="text-xs text-neutral-400">
          {phase.lengthWeeks} week{phase.lengthWeeks === 1 ? "" : "s"}, then{" "}
          {phase.isFinal
            ? "nothing's scheduled after that until the end date — assign a new program or add workouts on the calendar"
            : "moves to the next phase"}
        </p>
      </div>
      <span className="flex shrink-0 gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-neutral-500 hover:underline">
          Edit
        </button>
        <DeletePhaseButton phaseId={phase.id} />
      </span>
    </div>
  );
}
