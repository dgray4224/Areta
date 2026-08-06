"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserTrainerStatus } from "@/domains/users/service";
import { Button } from "@/platform/ui/Button";

/** No self-service trainer application/vetting flow exists yet — this is
 * the only way an account becomes a trainer today (see the
 * areta-trainer-b2b2c-vision memory for the deferred marketplace plan). */
export function TrainerStatusForm({
  targetUserId,
  isTrainer: initialIsTrainer,
}: {
  targetUserId: string;
  isTrainer: boolean;
}) {
  const router = useRouter();
  const [isTrainer, setIsTrainer] = useState(initialIsTrainer);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setUserTrainerStatus(targetUserId, isTrainer);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isTrainer} onChange={(e) => setIsTrainer(e.target.checked)} />
        Trainer — can be linked to clients and customize their goals, nutrition, and workout programs
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
        {isPending ? "Saving…" : "Save trainer status"}
      </Button>
    </div>
  );
}
