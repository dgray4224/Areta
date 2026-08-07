"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { unassignProgram, generateClientWorkoutPlanFromProgram, setClientAutoApprove } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import { sundayOfWeekContaining, addDays } from "@/domains/trainerprogram/calendar-projection";
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = sundayOfWeekContaining(today);
  const weekEnd = addDays(weekStart, 6);

  const onRegenerate = () => {
    setError(null);
    setWarnings([]);
    startTransition(async () => {
      const result = await generateClientWorkoutPlanFromProgram(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWarnings(result.data.warnings);
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

  const onToggleAutoApprove = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setClientAutoApprove(clientId, next);
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
            {assignment.endDate ? ` · ends ${assignment.endDate}` : ""}
          </p>
          {assignment.goalOutcome ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Goal: {assignment.goalOutcome}</p>
          ) : null}
        </div>
      </div>
      <label
        className="mt-3 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
        title="Skips the weekly manual approve click entirely — each week goes straight from the calendar to live for the client, no separate review step. Turning this on also immediately approves whatever draft is sitting there right now."
      >
        <input
          type="checkbox"
          checked={assignment.autoApprove}
          disabled={isPending}
          onChange={(e) => onToggleAutoApprove(e.target.checked)}
        />
        Automatically approve each week (skip the manual review click)
      </label>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {warnings.map((w, i) => (
        <p key={i} className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {w}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/trainer/clients/${clientId}/workout/calendar`}
          title="See the exact date-by-date schedule, edit or move individual days."
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
        >
          Calendar
        </Link>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={onRegenerate}
          title={`Re-materializes ${weekStart} – ${weekEnd}'s draft from the program (and any calendar edits) — use after changing the program's content. If nothing falls in that range, this stays empty; check the calendar for other weeks.`}
        >
          {isPending ? "Working…" : `Regenerate this week (${weekStart} – ${weekEnd})`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => setChanging((v) => !v)}
          title="Swap this client to a different one of your programs. The current assignment ends and a new one starts immediately — the old one stays in this client's history, not deleted."
        >
          {changing ? "Cancel" : "Change program"}
        </Button>
        <button
          type="button"
          disabled={isPending}
          onClick={onUnassign}
          title="Ends this assignment with no replacement — the client goes back to having no assigned program at all. Unlike Change program, nothing new starts."
          className="text-sm text-red-600 hover:underline"
        >
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
