"use client";

import { useState } from "react";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";
import { AssignMealProgramForm } from "./AssignMealProgramForm";
import type { PastMealAssignment, TrainerMealProgram } from "@/domains/trainermealprogram/types";

/** Mirrors the workout side's PastProgramsList.tsx -- ended assignments
 * stay listed here (never deleted), each with a "Reassign" button that
 * reopens AssignMealProgramForm pre-filled with that program and its old
 * goal wording. */
export function PastMealProgramsList({
  clientId,
  history,
  programs,
}: {
  clientId: string;
  history: PastMealAssignment[];
  programs: TrainerMealProgram[];
}) {
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  return (
    <details className="text-sm text-neutral-500">
      <summary className="cursor-pointer select-none">Past nutrition programs ({history.length})</summary>
      <div className="mt-3 space-y-2">
        {history.map((entry) => (
          <Card key={entry.id}>
            <p className="font-medium text-foreground">{entry.programName}</p>
            <p className="text-xs text-neutral-500">
              {entry.startsOn} → {entry.endDate ?? "?"}
            </p>
            {entry.goalOutcome ? <p className="mt-1 text-sm">Goal: {entry.goalOutcome}</p> : null}
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReassigningId((id) => (id === entry.id ? null : entry.id))}
                title="Use this program again, with new dates and a chance to update the goal."
              >
                {reassigningId === entry.id ? "Cancel" : "Reassign"}
              </Button>
            </div>
            {reassigningId === entry.id ? (
              <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <AssignMealProgramForm
                  clientId={clientId}
                  programs={programs}
                  initialProgramId={entry.programId}
                  initialGoalOutcome={entry.goalOutcome ?? undefined}
                />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </details>
  );
}
