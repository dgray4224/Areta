"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemTrainerInviteCode, endTrainerRelationship } from "@/domains/trainer/service";
import { TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import type { MyTrainerInfo } from "@/domains/trainer/types";

/** Branches on `initialTrainer` directly rather than mirroring it into
 * local state — same fix, same reasoning, as InviteCodePanel.tsx. Found
 * via manual browser testing (2026-08-06): an earlier version held its
 * own `useState(initialTrainer)` that only ever seeded once on mount, so
 * redeeming a code correctly linked the trainer server-side (and
 * cleared the input) but this panel kept showing the "enter a code"
 * form until a full reload. */
export function TrainerSettingsPanel({ initialTrainer }: { initialTrainer: MyTrainerInfo | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRedeem = () => {
    setError(null);
    startTransition(async () => {
      const result = await redeemTrainerInviteCode(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCode("");
      router.refresh();
    });
  };

  const onEnd = () => {
    setError(null);
    startTransition(async () => {
      const result = await endTrainerRelationship();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (initialTrainer) {
    return (
      <Card className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Your trainer</p>
          <p className="text-sm font-medium">{initialTrainer.trainerName || "Unnamed trainer"}</p>
          <p className="text-xs text-neutral-500">
            Since {new Date(initialTrainer.startedAt).toLocaleDateString()}
          </p>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Your trainer can see your logged history and current goals, nutrition, and workout plans, and
          can customize goals on your behalf. You can end this at any time — nothing they&apos;ve set
          gets removed, but they lose access going forward.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={onEnd}
          className="border-red-400 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          {isPending ? "Ending…" : "End trainer relationship"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Have an invite code from a trainer? Enter it below to give them access to customize your goals,
        nutrition, and workout programs, and to see your logged history. You can end this at any time.
      </p>
      <div className="max-w-xs">
        <TextInput
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code"
          aria-label="Trainer invite code"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" disabled={isPending || !code.trim()} onClick={onRedeem}>
        {isPending ? "Linking…" : "Link trainer"}
      </Button>
    </Card>
  );
}
