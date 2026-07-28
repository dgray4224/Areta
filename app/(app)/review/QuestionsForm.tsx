"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { weeklyReviewAnswersSchema, type WeeklyReviewAnswers } from "@/domains/review/schema";
import { submitWeeklyReviewAnswers, generateWeeklyBrief } from "@/domains/review/service";
import { FormField, TextArea } from "@/platform/ui/FormField";

const QUESTIONS: { name: keyof WeeklyReviewAnswers; label: string }[] = [
  { name: "wentWell", label: "What went well this week?" },
  { name: "difficult", label: "What was difficult?" },
  { name: "unrealistic", label: "What felt unrealistic?" },
  { name: "mealsToKeep", label: "Which meals should come back next week?" },
  { name: "mealsToDrop", label: "Which meals should not come back?" },
  { name: "missedTaskCauses", label: "What caused any missed tasks?" },
  { name: "whatShouldChange", label: "What should change next week?" },
  { name: "scheduleChanges", label: "Any new restrictions, appointments, or schedule changes?" },
];

export function QuestionsForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "saving" | "generating">("idle");

  const { register, handleSubmit } = useForm<WeeklyReviewAnswers>({
    resolver: zodResolver(weeklyReviewAnswersSchema),
  });

  const onSubmit = (values: WeeklyReviewAnswers) => {
    setError(null);
    startTransition(async () => {
      setStage("saving");
      const saveResult = await submitWeeklyReviewAnswers(userId, values);
      if (!saveResult.ok) {
        setError(saveResult.error);
        setStage("idle");
        return;
      }
      setStage("generating");
      const briefResult = await generateWeeklyBrief(userId);
      if (!briefResult.ok) {
        setError(briefResult.error);
        setStage("idle");
        return;
      }
      router.push("/review/brief");
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {QUESTIONS.map((q) => (
        <FormField key={q.name} label={q.label} htmlFor={q.name}>
          <TextArea id={q.name} {...register(q.name)} />
        </FormField>
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {stage === "saving"
          ? "Saving answers…"
          : stage === "generating"
            ? "Generating your weekly brief… (this can take 10-20 seconds)"
            : "Generate my weekly brief"}
      </button>
    </form>
  );
}
