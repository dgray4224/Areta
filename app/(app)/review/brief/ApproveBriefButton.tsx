"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveWeeklyReview } from "@/domains/review/approve-flow";
import type { RecommendationView } from "@/domains/review/service";

export function ApproveBriefButton({
  userId,
  recommendations,
}: {
  userId: string;
  recommendations: RecommendationView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveWeeklyReview(userId, Array.from(rejected));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="space-y-4">
      {recommendations.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-neutral-500">Proposed changes</h2>
          <div className="mt-2 space-y-2">
            {recommendations.map((r) => (
              <label
                key={r.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!rejected.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
                <div>
                  <p className="font-medium">
                    {r.field}
                    {r.previousValue !== null && r.proposedValue !== null
                      ? `: ${r.previousValue} → ${r.proposedValue}`
                      : ""}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">{r.reason}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Uncheck anything you don&apos;t want.</p>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={onApprove}
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Activating next week…" : "Approve and activate next week"}
      </button>
    </div>
  );
}
