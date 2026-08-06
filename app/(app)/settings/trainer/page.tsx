import { getMyTrainerRelationship } from "@/domains/trainer/service";
import { TrainerSettingsPanel } from "./TrainerSettingsPanel";

export default async function TrainerSettingsPage() {
  const trainer = await getMyTrainerRelationship();

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Link a personal trainer to your account, or manage your current one.
      </p>
      <TrainerSettingsPanel initialTrainer={trainer} />
    </div>
  );
}
