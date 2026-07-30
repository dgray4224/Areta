"use client";

import { useState, useTransition } from "react";
import { exportUserData } from "@/domains/account/export-service";

export function ExportDataButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await exportUserData(userId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `areta-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {isPending ? "Preparing export…" : "Export my data"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
