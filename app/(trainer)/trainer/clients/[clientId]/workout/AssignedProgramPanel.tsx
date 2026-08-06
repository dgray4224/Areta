"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { unassignProgram, generateClientWorkoutPlanFromProgram } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import type { TrainerProgramAssignment, TrainerProgram } from "@/domains/trainerprogram/types";
import { AssignProgramForm } from "./AssignProgramForm";

export function AssignedProgramPanel({
  clientId,
  assignment,
  programs,
}: {
  clientId: string;
  assignment: TrainerProgramAssignment;
  programs: TrainerProgram[];
}) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRegenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateClientWorkoutPlanFromProgram(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const onUnassign = () => {
    if (!confirm(`Unassign "${assignment.programName}" from this client?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await unassignProgram(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">Assigned program</p>
          <p className="font-medium">
            <Link href={`/trainer/programs/${assignment.programId}`} className="hover:underline">
              {assignment.programName}
            </Link>
          </p>
          <p className="text-sm text-neutral-500">
            {assignment.startsOn > new Date().toISOString().slice(0, 10)
              ? `Starts ${assignment.startsOn}`
              : assignment.currentPhaseName
                ? `${assignment.currentPhaseName}, week ${assignment.currentWeekInPhase}`
                : "Not started"}
          </p>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/trainer/clients/${clientId}/workout/calendar`}
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
        >
          Calendar
        </Link>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onRegenerate}>
          {isPending ? "Working…" : "Regenerate this week"}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => setChanging((v) => !v)}>
          {changing ? "Cancel" : "Change program"}
        </Button>
        <button type="button" disabled={isPending} onClick={onUnassign} className="text-sm text-red-600 hover:underline">
          Unassign
        </button>
      </div>
      {changing ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <AssignProgramForm clientId={clientId} programs={programs} />
        </div>
      ) : null}
    </Card>
  );
}
