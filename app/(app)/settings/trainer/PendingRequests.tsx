"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelTrainerRequest } from "@/domains/trainer/service";
import type { MyTrainerRequest } from "@/domains/trainer/types";

export function PendingRequests({ requests }: { requests: MyTrainerRequest[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pending = requests.filter((r) => r.status === "pending");

  if (pending.length === 0) return null;

  const onCancel = (id: string) => {
    startTransition(async () => {
      await cancelTrainerRequest(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Pending requests you&apos;ve sent</p>
      {pending.map((req) => (
        <div
          key={req.id}
          className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
        >
          <span>{req.trainerName || "Unnamed trainer"}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onCancel(req.id)}
            className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ))}
    </div>
  );
}
