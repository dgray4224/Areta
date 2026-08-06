"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/platform/ui/Button";

/** Shared generate/approve button pair for both the nutrition and
 * workout tabs — same two-step draft-then-approve flow the client uses
 * on themselves (CLAUDE.md rule 10: no generated plan goes live without
 * explicit approval). */
export function PlanActions({
  clientId,
  hasDraft,
  onGenerate,
  onApprove,
  generateLabel = "Generate plan",
  approveLabel = "Approve plan",
}: {
  clientId: string;
  hasDraft: boolean;
  onGenerate: (clientId: string) => Promise<{ ok: boolean; error?: string }>;
  onApprove: (clientId: string) => Promise<{ ok: boolean; error?: string }>;
  generateLabel?: string;
  approveLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (clientId: string) => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action(clientId);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => run(onGenerate)}>
          {isPending ? "Working…" : generateLabel}
        </Button>
        {hasDraft ? (
          <Button type="button" disabled={isPending} onClick={() => run(onApprove)}>
            {isPending ? "Working…" : approveLabel}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
