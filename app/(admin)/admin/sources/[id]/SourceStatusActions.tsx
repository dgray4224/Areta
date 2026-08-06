"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSourceStatus } from "@/domains/expertregistry/service";

export function SourceStatusActions({
  sourceId,
  currentStatus,
}: {
  sourceId: string;
  currentStatus: "active" | "archived";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (status: "active" | "archived") => {
    startTransition(async () => {
      await setSourceStatus(sourceId, status);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => setStatus(currentStatus === "active" ? "archived" : "active")}
      className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm hover:border-brand/40 disabled:opacity-50 dark:border-neutral-700"
    >
      {isPending ? "Saving…" : currentStatus === "active" ? "Archive" : "Reactivate"}
    </button>
  );
}
