"use client";

import { useState, useTransition } from "react";
import { Card } from "@/platform/ui/Card";
import { updateWeeklyOutcomeStatus, type WeeklyOutcomeCheckIn } from "@/domains/weeklyoutcomes/service";

export function OutcomesCheckInList({ userId, initialOutcomes }: { userId: string; initialOutcomes: WeeklyOutcomeCheckIn[] }) {
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mark = (id: string, status: "completed" | "dropped") => {
    setUpdatingId(id);
    setError(null);
    startTransition(async () => {
      const result = await updateWeeklyOutcomeStatus(userId, id, status);
      setUpdatingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOutcomes((prev) => prev.filter((o) => o.id !== id));
    });
  };

  if (outcomes.length === 0) {
    return (
      <Card tone="surface">
        <p className="text-sm text-neutral-500">Nothing proposed for this week yet — check back after generating a brief.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {outcomes.map((o) => (
        <Card key={o.id} tone="surface">
          <p className="text-sm">{o.outcomeText}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => mark(o.id, "completed")}
              disabled={isPending && updatingId === o.id}
              className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              Hit it
            </button>
            <button
              type="button"
              onClick={() => mark(o.id, "dropped")}
              disabled={isPending && updatingId === o.id}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-black/[0.03] disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
            >
              Missed
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
