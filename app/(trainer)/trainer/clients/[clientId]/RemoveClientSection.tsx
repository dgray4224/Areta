"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeClient } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";

/** Was missing entirely until the code-review pass caught it — a trainer
 * had a way to gain a client (invite codes) but no way to drop one. */
export function RemoveClientSection({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRemove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeClient(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/trainer");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 rounded-2xl border border-red-300 p-4 dark:border-red-900">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This ends your access to their goals, nutrition, and workout data. Nothing you&apos;ve set for
            them is removed.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={onRemove}
              className="border-red-400 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {isPending ? "Removing…" : "Confirm remove"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-neutral-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-700 hover:underline dark:text-red-400"
        >
          Remove this client
        </button>
      )}
    </div>
  );
}
