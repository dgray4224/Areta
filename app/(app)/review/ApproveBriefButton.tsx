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
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Proposed changes — tap to reject</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendations.map((r) => {
              const isRejected = rejected.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-opacity ${
                    isRejected
                      ? "border-neutral-300 text-neutral-400 opacity-50 dark:border-neutral-700"
                      : "border-brand text-neutral-900 dark:text-neutral-100"
                  }`}
                  title={r.reason}
                >
                  {r.field}
                </button>
              );
            })}
          </div>
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
