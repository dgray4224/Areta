import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { getTrainerStatus } from "@/platform/auth/trainer";
import { getMyTrainerRelationship, listMyTrainerRequests, getMyTrainerRoleRequest } from "@/domains/trainer/service";
import { TrainerSettingsPanel } from "./TrainerSettingsPanel";
import { PendingRequests } from "./PendingRequests";
import { BecomeATrainerSection } from "./BecomeATrainerSection";

export default async function TrainerSettingsPage() {
  const user = await requireUser();
  const [isTrainer, trainer, requests, roleRequest] = await Promise.all([
    getTrainerStatus(user.id),
    getMyTrainerRelationship(),
    listMyTrainerRequests(),
    getMyTrainerRoleRequest(),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Link a personal trainer to your account, or manage your current one. Have a code? Enter it below.
        Don&apos;t have one?{" "}
        <Link href="/trainers" className="underline">
          Browse trainers
        </Link>{" "}
        and send a request instead.
      </p>
      <TrainerSettingsPanel initialTrainer={trainer} />
      <PendingRequests requests={requests} />
      {/* A trainer doesn't need to also request the role -- and if
       * they're revoked later, is_trainer flips back to false and this
       * reappears, which is correct (they'd re-apply same as anyone
       * else, no residual fast-path). */}
      {!isTrainer ? <BecomeATrainerSection request={roleRequest} /> : null}
    </div>
  );
}
