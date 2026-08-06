"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "@/domains/trainerprogram/service";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm("Delete this session and its exercises?")) return;
    startTransition(async () => {
      const result = await deleteSession(sessionId);
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
      Delete
    </button>
  );
}
