"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerPrompt, dismissPrompt } from "@/domains/prompts/service";
import { TextArea } from "@/platform/ui/FormField";
import { Card } from "@/platform/ui/Card";
import { Button } from "@/platform/ui/Button";

export function PromptCard({
  userId,
  triggerId,
  question,
}: {
  userId: string;
  triggerId: string;
  question: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const onAnswer = () => {
    setError(null);
    startTransition(async () => {
      const result = await answerPrompt(userId, triggerId, answer);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDismissed(true);
      router.refresh();
    });
  };

  const onNotNow = () => {
    setError(null);
    startTransition(async () => {
      await dismissPrompt(userId, triggerId);
      setDismissed(true);
      router.refresh();
    });
  };

  return (
    <Card tone="surface">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Areta is curious</p>
      <p className="mt-1 text-sm font-medium">{question}</p>
      <div className="mt-2">
        <TextArea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Optional — answer in your own words"
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={onAnswer}
          disabled={isPending || !answer.trim()}
          className="!px-4 !py-1.5"
        >
          Answer
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onNotNow}
          disabled={isPending}
          className="!px-4 !py-1.5"
        >
          Not now
        </Button>
      </div>
    </Card>
  );
}
