"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExpertStatus } from "@/domains/expertregistry/service";
import type { ExpertStatus } from "@/domains/expertregistry/types";
import { Button } from "@/platform/ui/Button";

const ACTIONS: { status: ExpertStatus; label: string }[] = [
  { status: "approved", label: "Approve" },
  { status: "inactive", label: "Mark inactive" },
  { status: "excluded", label: "Exclude" },
];

export function ExpertStatusActions({
  expertId,
  currentStatus,
}: {
  expertId: string;
  currentStatus: ExpertStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (status: ExpertStatus) => {
    startTransition(async () => {
      await setExpertStatus(expertId, status);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.filter((a) => a.status !== currentStatus).map((a) => (
        <Button
          key={a.status}
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => setStatus(a.status)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
