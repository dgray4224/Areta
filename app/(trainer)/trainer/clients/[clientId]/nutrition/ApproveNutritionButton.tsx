"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveClientNutritionParameters } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";

export function ApproveNutritionButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveClientNutritionParameters(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" disabled={isPending} onClick={onApprove}>
        {isPending ? "Approving…" : "Approve targets as calculated"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
