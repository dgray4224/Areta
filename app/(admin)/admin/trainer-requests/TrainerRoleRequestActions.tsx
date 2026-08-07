"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveTrainerRoleRequest, rejectTrainerRoleRequest } from "@/domains/users/service";
import { Button } from "@/platform/ui/Button";

export function TrainerRoleRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onApprove = () => {
    startTransition(async () => {
      await approveTrainerRoleRequest(requestId);
      router.refresh();
    });
  };

  const onReject = () => {
    startTransition(async () => {
      await rejectTrainerRoleRequest(requestId);
      router.refresh();
    });
  };

  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" disabled={isPending} onClick={onApprove}>
        Approve
      </Button>
      <Button type="button" variant="secondary" disabled={isPending} onClick={onReject}>
        Reject
      </Button>
    </div>
  );
}
