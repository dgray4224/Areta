"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveClientWorkoutPlan } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";

/** Approve action for whatever draft is currently sitting in
 * workout_plans. As of 2026-08-07 the only path that still produces a
 * draft is a client's own self-generated plan (onboarding/library) for
 * someone not currently assigned a trainer program -- every trainer-
 * program materialization now writes 'active' directly (see
 * materializeWeek's doc comment), so this button only ever appears for
 * that one remaining case. */
export function ApproveWorkoutPlanButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveClientWorkoutPlan(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Button type="button" disabled={isPending} onClick={onApprove} title="Shows this week's plan to the client.">
        {isPending ? "Approving…" : "Approve this week's plan"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
