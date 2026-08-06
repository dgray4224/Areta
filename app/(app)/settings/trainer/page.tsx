import Link from "next/link";
import { getMyTrainerRelationship, listMyTrainerRequests } from "@/domains/trainer/service";
import { TrainerSettingsPanel } from "./TrainerSettingsPanel";
import { PendingRequests } from "./PendingRequests";

export default async function TrainerSettingsPage() {
  const [trainer, requests] = await Promise.all([getMyTrainerRelationship(), listMyTrainerRequests()]);

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
    </div>
  );
}
