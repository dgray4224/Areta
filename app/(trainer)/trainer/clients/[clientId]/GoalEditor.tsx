"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientGoal } from "@/domains/trainer/service";
import { SelectInput, TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { ClientGoal } from "@/domains/trainer/types";

/** The one write capability this pass ships — status and priority on an
 * existing goal. Full nutrition-parameter and workout-plan editors are
 * the deliberate next step, not built yet (the RLS underneath already
 * supports both — see migration 0066). */
export function GoalEditor({ goal, clientId }: { goal: ClientGoal; clientId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(goal.status);
  const [priority, setPriority] = useState(goal.priority?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = status !== goal.status || priority !== (goal.priority?.toString() ?? "");

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateClientGoal(goal.id, clientId, {
        status,
        priority: priority === "" ? null : Number(priority),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <p className="font-medium">{goal.outcome}</p>
        {goal.why ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{goal.why}</p> : null}
        {goal.targetDate ? (
          <p className="mt-1 text-xs text-neutral-500">Target: {goal.targetDate}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor={`status-${goal.id}`}>
            Status
          </label>
          <SelectInput
            id={`status-${goal.id}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as ClientGoal["status"])}
          >
            <option value="active">Active</option>
            <option value="achieved">Achieved</option>
            <option value="abandoned">Abandoned</option>
          </SelectInput>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor={`priority-${goal.id}`}>
            Priority
          </label>
          <TextInput
            id={`priority-${goal.id}`}
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <Button type="button" variant="secondary" disabled={!dirty || isPending} onClick={onSave}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
