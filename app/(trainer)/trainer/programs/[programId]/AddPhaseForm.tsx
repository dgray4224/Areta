"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPhase } from "@/domains/trainerprogram/service";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function AddPhaseForm({ programId }: { programId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [lengthWeeks, setLengthWeeks] = useState("4");
  const [isFinal, setIsFinal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Add phase
      </Button>
    );
  }

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await addPhase(programId, { name, focus, lengthWeeks: Number(lengthWeeks), isFinal });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setFocus("");
      setLengthWeeks("4");
      setIsFinal(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <FormField label="Phase name" htmlFor="phase-name">
        <TextInput
          id="phase-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hypertrophy block"
        />
      </FormField>
      <FormField label="Focus" htmlFor="phase-focus" hint="Optional — shows on the client's plan.">
        <TextArea id="phase-focus" value={focus} onChange={(e) => setFocus(e.target.value)} rows={2} />
      </FormField>
      <FormField label="Length (weeks)" htmlFor="phase-weeks" hint="Every week in this phase repeats identically.">
        <TextInput
          id="phase-weeks"
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
          {isPending ? "Saving…" : "Add phase"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
