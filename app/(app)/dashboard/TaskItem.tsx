"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/domains/tasks/service";
import { TASK_STATUSES, type TaskStatus } from "@/domains/tasks/schema";
import type { TodayTask } from "./data";

const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "Planned",
  completed: "Completed",
  partially_completed: "Partially completed",
  skipped: "Skipped",
  deferred: "Deferred",
  not_applicable: "N/A",
};

export function TaskItem({ userId, task }: { userId: string; task: TodayTask }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSkipReason, setPendingSkipReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyStatus = (status: TaskStatus, skipReason?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateTaskStatus(userId, { taskId: task.id, status, skipReason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPendingSkipReason(null);
      router.refresh();
    });
  };

  const onStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as TaskStatus;
    if (status === "skipped") {
      setPendingSkipReason("");
      return;
    }
    applyStatus(status);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{task.title}</p>
          {task.description ? <p className="text-xs text-neutral-500">{task.description}</p> : null}
        </div>
        <select
          value={task.status}
          onChange={onStatusChange}
          disabled={isPending}
          className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {task.skipReason ? <p className="text-xs text-neutral-500">Reason: {task.skipReason}</p> : null}

      {pendingSkipReason !== null ? (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Reason (optional)"
            value={pendingSkipReason}
            onChange={(e) => setPendingSkipReason(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="button"
            onClick={() => applyStatus("skipped", pendingSkipReason || undefined)}
            className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Confirm skip
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
