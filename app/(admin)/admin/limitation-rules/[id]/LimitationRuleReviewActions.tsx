"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewLimitationRule } from "@/domains/expertregistry/service";
import type { ReviewStatus } from "@/domains/expertregistry/types";
import { Button } from "@/platform/ui/Button";

export function LimitationRuleReviewActions({
  ruleId,
  currentStatus,
  reviewerId,
}: {
  ruleId: string;
  currentStatus: ReviewStatus;
  reviewerId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const review = (status: "approved" | "rejected") => {
    startTransition(async () => {
      await reviewLimitationRule(ruleId, status, reviewerId);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus !== "approved" ? (
        <Button type="button" disabled={isPending} onClick={() => review("approved")}>
          Approve
        </Button>
      ) : null}
      {currentStatus !== "rejected" ? (
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => review("rejected")}
        >
          Reject
        </Button>
      ) : null}
    </div>
  );
}
