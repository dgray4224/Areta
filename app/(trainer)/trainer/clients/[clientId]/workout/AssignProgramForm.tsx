"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignProgramToClient } from "@/domains/trainer/service";
import { SelectInput, TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { TrainerProgram } from "@/domains/trainerprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssignProgramForm({ clientId, programs }: { clientId: string; programs: TrainerProgram[] }) {
  const router = useRouter();
  const [programId, setProgramId] = useState("");
  const [onComplete, setOnComplete] = useState<"repeat" | "freeze">("repeat");
  const [startsOn, setStartsOn] = useState(todayIso());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (programs.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        You haven&apos;t published a program yet.{" "}
        <Link href="/trainer/programs/new" className="underline">
          Build one
        </Link>{" "}
        to assign it here.
      </p>
    );
  }

  const onAssign = () => {
    if (!programId) {
      setError("Pick a program.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignProgramToClient(clientId, programId, onComplete, startsOn);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <SelectInput value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Program">
          <option value="">Pick a program…</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectInput>
        <TextInput
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          aria-label="Starts on"
        />
        <SelectInput
          value={onComplete}
          onChange={(e) => setOnComplete(e.target.value as "repeat" | "freeze")}
          aria-label="When the program finishes"
        >
          <option value="repeat">When finished: repeat from the start</option>
          <option value="freeze">When finished: keep the last week</option>
        </SelectInput>
      </div>
      <p className="text-xs text-neutral-500">
        A future start date won&apos;t generate anything until that week arrives.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" disabled={isPending} onClick={onAssign}>
        {isPending ? "Assigning…" : "Assign program"}
      </Button>
    </div>
  );
}
