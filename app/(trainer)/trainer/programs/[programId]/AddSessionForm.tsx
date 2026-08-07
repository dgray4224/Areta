"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSession } from "@/domains/trainerprogram/service";
import { SelectInput, TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AddSessionForm({ phaseId, takenDays }: { phaseId: string; takenDays: number[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [name, setName] = useState("");
  const [sessionType, setSessionType] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        + Add session day
      </button>
    );
  }

  const onSave = () => {
    if (dayOfWeek === "") {
      setError("Pick a day.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addSession(phaseId, { dayOfWeek: Number(dayOfWeek), name, sessionType });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setDayOfWeek("");
      setName("");
      setSessionType("");
      router.refresh();
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="grid grid-cols-2 gap-2">
        <SelectInput value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} aria-label="Day of week">
          <option value="">Day…</option>
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i} disabled={takenDays.includes(i)}>
              {d}
            </option>
          ))}
        </SelectInput>
        <TextInput placeholder="Session type (optional)" value={sessionType} onChange={(e) => setSessionType(e.target.value)} />
      </div>
      <TextInput placeholder="Session name, e.g. Upper Body A" value={name} onChange={(e) => setName(e.target.value)} />
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
