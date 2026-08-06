"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProgramStatus } from "@/domains/trainerprogram/service";
import { Button } from "@/platform/ui/Button";
import type { TrainerProgramStatus } from "@/domains/trainerprogram/types";

export function ProgramStatusActions({ programId, status }: { programId: string; status: TrainerProgramStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (next: TrainerProgramStatus) => {
    startTransition(async () => {
      const result = await setProgramStatus(programId, next);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex gap-2">
      {status !== "published" ? (
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => setStatus("published")}>
          Publish
        </Button>
      ) : (
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => setStatus("draft")}>
          Move to draft
        </Button>
      )}
      {status !== "archived" ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setStatus("archived")}
          className="text-sm text-red-600 hover:underline"
        >
          Archive
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setStatus("draft")}
          className="text-sm text-neutral-500 hover:underline"
        >
          Restore to draft
        </button>
      )}
    </div>
  );
}
