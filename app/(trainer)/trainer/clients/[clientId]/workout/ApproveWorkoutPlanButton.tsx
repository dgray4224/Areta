"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveClientWorkoutPlan } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";

/** Standalone approve action for whatever draft is currently sitting in
 * workout_plans, regardless of source -- split out from the removed
 * library-generate flow (2026-08-06: trainers can no longer generate a
 * plan from the shared library themselves, only assign/customize their
 * own authored programs, but a trainer-program-sourced draft still needs
 * an explicit approval before it goes live, same as any other plan
 * under CLAUDE.md rule 10). approveWorkoutPlan itself is source-agnostic
 * (just flips status by week_start), so this works whether the draft
 * came from a trainer program or, for a client not currently assigned
 * one, from the client's own onboarding-driven generation. */
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
      <Button type="button" disabled={isPending} onClick={onApprove} title="Makes this week's draft live for the client.">
        {isPending ? "Approving…" : "Approve this week's plan"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
