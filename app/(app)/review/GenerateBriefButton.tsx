"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateWeeklyBrief } from "@/domains/review/service";

export function GenerateBriefButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateWeeklyBrief(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/review/brief");
    });
  };

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={onGenerate}
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Generating your weekly brief… (this can take 10-20 seconds)" : "Generate my weekly brief"}
      </button>
    </div>
  );
}
