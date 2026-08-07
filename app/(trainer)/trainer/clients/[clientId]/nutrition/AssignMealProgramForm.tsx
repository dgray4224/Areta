"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignMealProgramToClient } from "@/domains/trainer/service";
import { SelectInput, TextInput, TextArea, FormField } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { TrainerMealProgram } from "@/domains/trainermealprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssignMealProgramForm({
  clientId,
  programs,
  initialProgramId,
  initialGoalOutcome,
}: {
  clientId: string;
  programs: TrainerMealProgram[];
  /** Prefill for reassigning a program from a client's past-programs
   * history -- same "recycle it again, perhaps with modifications" as
   * the workout side's AssignProgramForm.tsx. */
  initialProgramId?: string;
  initialGoalOutcome?: string;
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(initialProgramId ?? "");
  const [startsOn, setStartsOn] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [goalOutcome, setGoalOutcome] = useState(initialGoalOutcome ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (programs.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        You haven&apos;t published a nutrition program yet.{" "}
        <Link href="/trainer/meal-programs/new" className="underline">
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
    if (!goalOutcome.trim()) {
      setError("State a tangible goal for this program.");
      return;
    }
    if (!endDate) {
      setError("Set an end date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignMealProgramToClient(clientId, programId, startsOn, endDate, goalOutcome);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <SelectInput
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          aria-label="Program"
          title="Pick which nutrition program this client will follow."
        >
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
          title="The day the program starts. Pick a future date to start it later."
        />
        <TextInput
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="Ends on"
          title="Required. The program stops on this day."
        />
      </div>
      <FormField
        label="Tangible goal"
        htmlFor="meal-goal-outcome"
        hint="What this program should achieve. Shows up on the client's own Goals list."
      >
        <TextArea
          id="meal-goal-outcome"
          rows={2}
          value={goalOutcome}
          onChange={(e) => setGoalOutcome(e.target.value)}
          placeholder="e.g. Lose 10 lb while keeping strength up"
        />
      </FormField>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" disabled={isPending} onClick={onAssign}>
        {isPending ? "Assigning…" : "Assign program"}
      </Button>
    </div>
  );
}
