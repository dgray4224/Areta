"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/domains/account/delete-service";
import { Button } from "@/platform/ui/Button";

export function DeleteAccountButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/login");
    });
  };

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <p className="text-sm text-red-800 dark:text-red-200">
        This permanently deletes your Areta account and all of your data — plans, logs, and
        connections. This can&apos;t be undone.
      </p>
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Yes, delete my account"}
        </button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
