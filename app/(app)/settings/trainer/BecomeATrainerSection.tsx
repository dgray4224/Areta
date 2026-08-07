"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestTrainerRole, cancelTrainerRoleRequest } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import type { MyTrainerRoleRequest } from "@/domains/trainer/types";

/** No local mirror of `request` in state -- same pattern as
 * PendingRequests.tsx, renders straight off the server-fetched prop and
 * relies on router.refresh() to pull a fresh one after any action. Only
 * the message textarea needs its own state. */
export function BecomeATrainerSection({ request }: { request: MyTrainerRoleRequest | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestTrainerRole(message);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("");
      router.refresh();
    });
  };

  const onCancel = () => {
    if (!request) return;
    startTransition(async () => {
      await cancelTrainerRoleRequest(request.id);
      router.refresh();
    });
  };

  // A rejected or cancelled request doesn't block trying again --
  // pending is the only status that hides the form.
  const canRequest = !request || request.status === "rejected" || request.status === "cancelled";

  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm font-medium">Become a trainer</p>

      {request?.status === "pending" ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Your request is pending review.</span>
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {request?.status === "rejected" ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Your last request wasn&apos;t approved. You can submit another below.
        </p>
      ) : null}

      {canRequest ? (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Want to coach clients on Areta? Tell us a bit about yourself and we&apos;ll review your request.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional — certifications, experience, who you'd like to train..."
            rows={3}
            className="w-full rounded-lg border border-neutral-200 bg-transparent p-2 text-sm dark:border-neutral-800"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="button" variant="secondary" disabled={isPending} onClick={onSubmit}>
            {isPending ? "Submitting…" : "Request trainer access"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
