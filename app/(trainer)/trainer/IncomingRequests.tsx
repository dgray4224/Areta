"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToTrainerRequest } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import type { IncomingTrainerRequest } from "@/domains/trainer/types";

export function IncomingRequests({ initialRequests }: { initialRequests: IncomingTrainerRequest[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const respond = (id: string, accept: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await respondToTrainerRequest(id, accept);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    });
  };

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-medium">
          {requests.length} client request{requests.length === 1 ? "" : "s"}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          People who found you and want you as their trainer. Accept to make them your client.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-2">
        {requests.map((req) => (
          <Card key={req.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{req.clientName || "Unnamed client"}</p>
                {req.message ? (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{req.message}</p>
                ) : null}
                <p className="mt-1 text-xs text-neutral-500">{new Date(req.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" disabled={isPending} onClick={() => respond(req.id, true)}>
                  Accept
                </Button>
                <Button type="button" variant="secondary" disabled={isPending} onClick={() => respond(req.id, false)}>
                  Decline
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
