"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { unassignMealProgram } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import { MealPortionsEditor } from "./MealPortionsEditor";
import { AssignMealProgramForm } from "./AssignMealProgramForm";
import { EngagementNutritionTargets } from "./EngagementNutritionTargets";
import type { TrainerMealProgramAssignment } from "@/domains/trainermealprogram/types";
import type { TrainerMealProgram } from "@/domains/trainermealprogram/types";

export function AssignedMealProgramPanel({
  clientId,
  assignment,
  programs,
}: {
  clientId: string;
  assignment: TrainerMealProgramAssignment;
  programs: TrainerMealProgram[];
}) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [editingPortions, setEditingPortions] = useState(false);
  const [editingTargets, setEditingTargets] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const hasStarted = assignment.startsOn <= today;

  const onUnassign = () => {
    if (!confirm(`Unassign "${assignment.programName}" from this client?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await unassignMealProgram(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">Assigned nutrition program</p>
          <p className="font-medium">
            <Link href={`/trainer/meal-programs/${assignment.programId}`} className="hover:underline">
              {assignment.programName}
            </Link>
          </p>
          <p className="text-sm text-neutral-500">
            {!hasStarted
              ? `Starts ${assignment.startsOn}`
              : assignment.currentPhaseName
                ? `${assignment.currentPhaseName}, week ${assignment.currentWeekInPhase}`
                : "Nothing scheduled right now"}
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
      <div className="mt-3 flex flex-wrap gap-2">
        {assignment.currentPhaseId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => setEditingPortions((v) => !v)}
            title="Set how much of each meal this client actually eats — we suggest a starting point from their approved calorie target, you fine-tune it."
          >
            {editingPortions ? "Cancel" : "Edit portions"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => setEditingTargets((v) => !v)}
          title="Recalculate calorie/protein targets scoped to this engagement's own dates, instead of the client's long-range goal."
        >
          {editingTargets ? "Cancel" : assignment.nutritionOverride ? "Edit engagement target" : "Engagement target"}
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
      {editingPortions && assignment.currentPhaseId ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          {/* key={assignment.id}, not just phaseId: phases belong to the
           * program, not the assignment, so reassigning to a program that
           * resolves back to the same current phase (e.g. reassigning the
           * same program from day 1 again) wouldn't otherwise change
           * MealPortionsEditor's props and it would keep showing the prior
           * assignment's stale fetched rows instead of refetching for the
           * new one. */}
          <MealPortionsEditor key={assignment.id} clientId={clientId} phaseId={assignment.currentPhaseId} />
        </div>
      ) : null}
      {editingTargets ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <EngagementNutritionTargets
            key={assignment.id}
            clientId={clientId}
            startsOn={assignment.startsOn}
            endDate={assignment.endDate}
            nutritionOverride={assignment.nutritionOverride}
          />
        </div>
      ) : null}
      {changing ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <AssignMealProgramForm clientId={clientId} programs={programs} />
        </div>
      ) : null}
    </Card>
  );
}
