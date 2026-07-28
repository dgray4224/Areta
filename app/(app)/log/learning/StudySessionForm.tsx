"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studySessionSchema, type StudySessionInput } from "@/domains/learning/log-schema";
import { logStudySession } from "@/domains/learning/log-service";
import { FormField, TextInput, TextArea, optionalNumberValue } from "@/platform/ui/FormField";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StudySessionForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudySessionInput>({
    resolver: zodResolver(studySessionSchema),
    defaultValues: { date: todayDateString() },
  });

  const onSubmit = (values: StudySessionInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await logStudySession(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Log study session</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date" htmlFor="date" error={errors.date?.message}>
            <TextInput id="date" type="date" {...register("date")} />
          </FormField>
          <FormField label="Track" htmlFor="track">
            <TextInput id="track" placeholder="e.g. AI Engineering" {...register("track")} />
          </FormField>
        </div>
        <FormField label="What did you work on?" htmlFor="task" error={errors.task?.message}>
          <TextInput id="task" autoFocus {...register("task")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Duration (minutes)" htmlFor="durationMinutes">
            <TextInput
              id="durationMinutes"
              type="number"
              min={0}
              {...register("durationMinutes", { setValueAs: optionalNumberValue })}
            />
          </FormField>
          <FormField label="Focus (1-5)" htmlFor="focus">
            <TextInput
              id="focus"
              type="number"
              min={1}
              max={5}
              {...register("focus", { setValueAs: optionalNumberValue })}
            />
          </FormField>
        </div>
        <FormField label="Output / artifact" htmlFor="output" hint="What you produced, if anything">
          <TextInput id="output" {...register("output")} />
        </FormField>
        <FormField label="Link" htmlFor="link">
          <TextInput id="link" type="url" {...register("link")} />
        </FormField>
        <FormField label="Reflection" htmlFor="reflection">
          <TextArea id="reflection" {...register("reflection")} />
        </FormField>
        <FormField label="Next step" htmlFor="nextStep">
          <TextInput id="nextStep" {...register("nextStep")} />
        </FormField>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
