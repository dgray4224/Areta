"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { unassignProgram, bulkApproveClientWeeks } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import { addDays } from "@/domains/trainerprogram/calendar-projection";
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
  const [bulkApproving, setBulkApproving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Defaults to the assignment's own end date (2026-08-07, user feedback)
  // -- "push everything live through the end of the program" is the
  // common case; the +28-days guess only kicks in for the defensive
  // null case (every real assignment requires an end date, enforced in
  // AssignProgramForm, but the type stays nullable -- see
  // TrainerProgramAssignment's own doc comment).
  const [bulkThroughDate, setBulkThroughDate] = useState(
    () => assignment.endDate ?? addDays(new Date().toISOString().slice(0, 10), 28)
  );
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

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

  const onBulkApprove = () => {
    setError(null);
    setBulkResult(null);
    startTransition(async () => {
      const result = await bulkApproveClientWeeks(clientId, bulkThroughDate);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWarnings(result.data.warnings);
      setBulkResult(
        `Pushed ${result.data.weeksGenerated} week${result.data.weeksGenerated === 1 ? "" : "s"} live, through ${bulkThroughDate}.`
      );
      router.refresh();
    });
  };

  const hasStarted = assignment.startsOn <= today;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
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
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            hasStarted
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
          }`}
          title={hasStarted ? "This program is live for the client right now." : "This program hasn't started yet."}
        >
          {hasStarted ? "Active" : "Upcoming"}
        </span>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {bulkResult ? <p className="mt-2 text-sm text-green-700 dark:text-green-400">{bulkResult}</p> : null}
      {warnings.map((w, i) => (
        <p key={i} className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {w}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/trainer/clients/${clientId}/workout/calendar`}
          title="See and edit each day's workout."
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
        >
          Calendar
        </Link>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => setBulkApproving((v) => !v)}
          title="Make several weeks of workouts go live right now, instead of one week at a time."
        >
          {bulkApproving ? "Cancel" : "Push weeks live"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => setChanging((v) => !v)}
          title="Switch this client to a different program. Their old one is saved, not deleted."
        >
          {changing ? "Cancel" : "Change program"}
        </Button>
        <button
          type="button"
          disabled={isPending}
          onClick={onUnassign}
          title="Removes this client's program completely. Nothing new replaces it."
          className="text-sm text-red-600 hover:underline"
        >
          Unassign
        </button>
      </div>
      {bulkApproving ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
            Makes the client&apos;s workouts live right away, all the way through the date below — including
            anything you&apos;ve already changed on the calendar. Use this instead of waiting for it to go live
            one week at a time.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Push all weeks live through
              <input
                type="date"
                value={bulkThroughDate}
                min={today}
                max={assignment.endDate ?? undefined}
                onChange={(e) => setBulkThroughDate(e.target.value)}
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <Button type="button" disabled={isPending} onClick={onBulkApprove}>
              {isPending ? "Working…" : "Push live"}
            </Button>
          </div>
        </div>
      ) : null}
      {changing ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <AssignProgramForm clientId={clientId} programs={programs} />
        </div>
      ) : null}
    </Card>
  );
}
