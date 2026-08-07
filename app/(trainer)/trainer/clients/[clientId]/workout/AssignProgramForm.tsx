"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignProgramToClient } from "@/domains/trainer/service";
import { SelectInput, TextInput, TextArea, FormField } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { TrainerProgram } from "@/domains/trainerprogram/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssignProgramForm({
  clientId,
  programs,
  initialProgramId,
  initialGoalOutcome,
}: {
  clientId: string;
  programs: TrainerProgram[];
  /** Prefill for reassigning a program from a client's past-programs
   * history -- "recycle it again, perhaps with modifications": the
   * trainer still reviews and resubmits dates/goal fresh rather than
   * silently reusing the old ones (a completed program's original end
   * date, for instance, is almost certainly in the past by the time
   * they're looking at this). */
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
      const result = await assignProgramToClient(clientId, programId, startsOn, endDate, goalOutcome);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // A plain router.refresh() wouldn't carry these warnings anywhere
      // to display -- this form unmounts once an assignment exists
      // (replaced by AssignedProgramPanel), so any local state here
      // would vanish with it. Routing through a query param (same
      // pattern as the program builder's importWarnings) survives that
      // swap.
      if (result.data.warnings.length > 0) {
        router.push(`/trainer/clients/${clientId}/workout?assignWarnings=${encodeURIComponent(JSON.stringify(result.data.warnings))}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <SelectInput
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          aria-label="Program"
          title="Pick which program this client will follow."
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
          title="Required. The program stops on this day. If it runs out of workouts before then, add more on the calendar or assign a new program."
        />
      </div>
      <FormField
        label="Tangible goal"
        htmlFor="goal-outcome"
        hint="What this program should achieve. Shows up on the client's own Goals list."
      >
        <TextArea
          id="goal-outcome"
          rows={2}
          value={goalOutcome}
          onChange={(e) => setGoalOutcome(e.target.value)}
          placeholder="e.g. Increase back squat 1RM by 20 lb"
        />
      </FormField>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" disabled={isPending} onClick={onAssign}>
        {isPending ? "Assigning…" : "Assign program"}
      </Button>
    </div>
  );
}
