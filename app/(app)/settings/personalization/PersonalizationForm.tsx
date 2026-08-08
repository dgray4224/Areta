"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  coachingSchema,
  NEVER_RECOMMEND_SUGGESTIONS,
  type CoachingInput,
} from "@/domains/coaching/schema";
import { updatePersonalizationProfile } from "@/domains/coaching/service";
import { workScheduleSchema, type WorkScheduleInput } from "@/domains/identity/schema";
import { updateWorkSchedule } from "@/domains/identity/service";
import { FormField, TextInput, TextArea, SelectInput, optionalNumberValue } from "@/platform/ui/FormField";
import { TagPicker } from "@/platform/ui/TagPicker";
import { Button } from "@/platform/ui/Button";

export function PersonalizationForm({
  userId,
  coachingDefaults,
  workScheduleDefaults,
}: {
  userId: string;
  coachingDefaults: Partial<CoachingInput>;
  workScheduleDefaults: Partial<WorkScheduleInput>;
}) {
  return (
    <div className="space-y-10">
      <CoachingSection userId={userId} defaultValues={coachingDefaults} />
      <WorkScheduleSection userId={userId} defaultValues={workScheduleDefaults} />
    </div>
  );
}

function CoachingSection({
  userId,
  defaultValues,
}: {
  userId: string;
  defaultValues: Partial<CoachingInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CoachingInput>({
    resolver: zodResolver(coachingSchema),
    defaultValues,
  });

  const onSubmit = (values: CoachingInput) => {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePersonalizationProfile(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="text-sm font-semibold">Coaching</h2>
      <p className="mt-1 text-sm text-neutral-500">
        How Areta should talk to you and handle your plan.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tone" htmlFor="tone" error={errors.tone?.message}>
            <SelectInput id="tone" {...register("tone")}>
              <option value="direct">Direct</option>
              <option value="gentle">Gentle</option>
            </SelectInput>
          </FormField>
          <FormField label="Planning style" htmlFor="planningStyle" error={errors.planningStyle?.message}>
            <SelectInput id="planningStyle" {...register("planningStyle")}>
              <option value="strict">Strict</option>
              <option value="flexible">Flexible</option>
            </SelectInput>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Reminders"
            htmlFor="reminderPreference"
            error={errors.reminderPreference?.message}
          >
            <SelectInput id="reminderPreference" {...register("reminderPreference")}>
              <option value="frequent">Frequent</option>
              <option value="minimal">Minimal</option>
              <option value="none">None</option>
            </SelectInput>
          </FormField>
          <FormField
            label="Explanation depth"
            htmlFor="explanationDepth"
            error={errors.explanationDepth?.message}
          >
            <SelectInput id="explanationDepth" {...register("explanationDepth")}>
              <option value="brief">Brief</option>
              <option value="detailed">Detailed</option>
            </SelectInput>
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("rescheduleMissedTasks")} />
          Reschedule missed tasks automatically
        </label>

        <FormField label="Never recommend" htmlFor="neverRecommend">
          <Controller
            name="neverRecommend"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="neverRecommend"
                suggestions={NEVER_RECOMMEND_SUGGESTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        {saved && !isPending ? (
          <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
        ) : null}

        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save coaching preferences"}
        </Button>
      </form>
    </section>
  );
}

function WorkScheduleSection({
  userId,
  defaultValues,
}: {
  userId: string;
  defaultValues: Partial<WorkScheduleInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkScheduleInput>({
    resolver: zodResolver(workScheduleSchema),
    defaultValues,
  });

  const onSubmit = (values: WorkScheduleInput) => {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateWorkSchedule(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="text-sm font-semibold">Work &amp; school</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Optional context — Areta can plan around this once you tell it.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <FormField label="Work status" htmlFor="workStatus" error={errors.workStatus?.message}>
          <TextInput id="workStatus" placeholder="e.g. Full-time, remote" {...register("workStatus")} />
        </FormField>
        <FormField label="Work hours" htmlFor="workHoursNote" error={errors.workHoursNote?.message}>
          <TextInput
            id="workHoursNote"
            placeholder="e.g. 9am-5pm weekdays"
            {...register("workHoursNote")}
          />
        </FormField>
        <FormField
          label="School commitments"
          htmlFor="schoolCommitments"
          error={errors.schoolCommitments?.message}
        >
          <TextArea id="schoolCommitments" {...register("schoolCommitments")} />
        </FormField>
        <FormField
          label="Learning time per week (minutes)"
          htmlFor="learningTimeMinutesPerWeek"
          error={errors.learningTimeMinutesPerWeek?.message}
        >
          <TextInput
            id="learningTimeMinutesPerWeek"
            type="number"
            min={0}
            {...register("learningTimeMinutesPerWeek", { setValueAs: optionalNumberValue })}
          />
        </FormField>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        {saved && !isPending ? (
          <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
        ) : null}

        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save work & school"}
        </Button>
      </form>
    </section>
  );
}
