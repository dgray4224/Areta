"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhase } from "@/domains/trainermealprogram/service";

export function DeletePhaseButton({ phaseId }: { phaseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm("Delete this phase and everything in it?")) return;
    startTransition(async () => {
      const result = await deletePhase(phaseId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onDelete}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      Delete phase
    </button>
  );
}
