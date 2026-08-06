"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestTrainer } from "@/domains/trainer/service";
import { TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function RequestTrainerButton({ trainerId }: { trainerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return <p className="text-sm text-green-700 dark:text-green-400">Request sent.</p>;
  }

  const onSend = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestTrainer(trainerId, message);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Request this trainer
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <TextArea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Optional note — what are you looking for?"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={isPending} onClick={onSend}>
          {isPending ? "Sending…" : "Send request"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
