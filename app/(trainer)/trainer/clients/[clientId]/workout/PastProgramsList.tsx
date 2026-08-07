"use client";

import { useState } from "react";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";
import { AssignProgramForm } from "./AssignProgramForm";
import type { PastAssignment, TrainerProgram } from "@/domains/trainerprogram/types";

/** The archive item 4 asked for -- ended assignments stay listed here
 * (never deleted), each with a "Reassign" button that reopens
 * AssignProgramForm pre-filled with that program and its old goal
 * wording, so the trainer can recycle it (editing the program itself
 * first, if they want modifications) rather than rebuilding from
 * scratch. Only rendered when there's at least one past assignment --
 * see the workout page. */
export function PastProgramsList({
  clientId,
  history,
  programs,
}: {
  clientId: string;
  history: PastAssignment[];
  programs: TrainerProgram[];
}) {
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  return (
    <details className="text-sm text-neutral-500">
      <summary className="cursor-pointer select-none">
        Past programs ({history.length})
      </summary>
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
                <AssignProgramForm
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
