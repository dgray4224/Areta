"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EXERCISE_GOALS,
  EXERCISE_GOAL_LABELS,
  RECENT_EXPERIENCE_LEVELS,
  RECENT_EXPERIENCE_LABELS,
  DAYS_PER_WEEK_OPTIONS,
  SESSION_DURATION_BANDS,
  SESSION_DURATION_LABELS,
  TRAINING_LOCATIONS,
  TRAINING_LOCATION_LABELS,
  PREFERRED_ACTIVITIES,
  PREFERRED_ACTIVITY_LABELS,
  INJURY_STATUS_OPTIONS,
  LIMITATION_TAGS,
  LIMITATION_TAG_LABELS,
  PROFESSIONAL_CLEARANCE_RED_FLAGS,
  EQUIPMENT_SUGGESTIONS,
  exerciseSchema,
  type ExerciseInput,
} from "@/domains/exercise/schema";
import { saveExerciseStep } from "@/domains/exercise/service";
import { StepShell } from "@/platform/ui/StepShell";
import { FormField, TextInput, TextArea, SelectInput, optionalStringValue } from "@/platform/ui/FormField";
import { TagPicker, chipBase, chipSelected, chipUnselected } from "@/platform/ui/TagPicker";
import { Button } from "@/platform/ui/Button";

const SUB_STEP_COUNT = 8;

export function ExerciseForm({
  userId,
  defaultValues,
  stepIndex,
  totalSteps,
  backHref,
}: {
  userId: string;
  defaultValues: Partial<ExerciseInput>;
  stepIndex: number;
  totalSteps: number;
  backHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [subStep, setSubStep] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<ExerciseInput>({
    resolver: zodResolver(exerciseSchema),
    defaultValues,
  });

  const primaryGoal = useWatch({ control, name: "primaryGoal" });
  const injuryStatus = useWatch({ control, name: "injuryStatus" });

  const onSubmit = (values: ExerciseInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveExerciseStep(userId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding");
    });
  };

  const goNext = async () => {
    // Q8's fields live under "goalDetail" so no per-substep field list is
    // needed here -- a light touch: only block advancing on real schema
    // errors already surfaced for fields on the current screen isn't worth
    // the complexity of per-step field allowlists for a handful of mostly
    // optional questions, so we just re-validate the whole form quietly.
    await trigger();
    setSubStep((s) => Math.min(s + 1, SUB_STEP_COUNT - 1));
  };
  const goBack = () => setSubStep((s) => Math.max(s - 1, 0));

  return (
    <StepShell
      title="Exercise"
      description="A few questions so Areta can build the right training plan for you."
      currentStep={stepIndex}
      totalSteps={totalSteps}
      backHref={subStep === 0 ? backHref : undefined}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <p className="text-xs text-neutral-500">
          Question {subStep + 1} of {SUB_STEP_COUNT}
        </p>

        {subStep === 0 ? (
          <FormField label="What is your primary goal?" htmlFor="primaryGoal" error={errors.primaryGoal?.message}>
            <SelectInput id="primaryGoal" {...register("primaryGoal", { setValueAs: optionalStringValue })}>
              <option value="">—</option>
              {EXERCISE_GOALS.map((g) => (
                <option key={g} value={g}>
                  {EXERCISE_GOAL_LABELS[g]}
                </option>
              ))}
            </SelectInput>
          </FormField>
        ) : null}

        {subStep === 1 ? (
          <FormField
            label="What best describes your exercise experience during the last three months?"
            htmlFor="recentExperience"
            error={errors.recentExperience?.message}
          >
            <SelectInput id="recentExperience" {...register("recentExperience", { setValueAs: optionalStringValue })}>
              <option value="">—</option>
              {RECENT_EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {RECENT_EXPERIENCE_LABELS[level]}
                </option>
              ))}
            </SelectInput>
          </FormField>
        ) : null}

        {subStep === 2 ? (
          <FormField
            label="How many days can you realistically train each week?"
            htmlFor="daysPerWeek"
            error={errors.daysPerWeek?.message}
          >
            <SelectInput id="daysPerWeek" {...register("daysPerWeek", { setValueAs: optionalStringValue })}>
              <option value="">—</option>
              {DAYS_PER_WEEK_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === "5_plus" ? "5+" : d}
                </option>
              ))}
            </SelectInput>
          </FormField>
        ) : null}

        {subStep === 3 ? (
          <FormField
            label="How long should a typical workout be?"
            htmlFor="sessionDurationBand"
            error={errors.sessionDurationBand?.message}
          >
            <SelectInput id="sessionDurationBand" {...register("sessionDurationBand", { setValueAs: optionalStringValue })}>
              <option value="">—</option>
              {SESSION_DURATION_BANDS.map((band) => (
                <option key={band} value={band}>
                  {SESSION_DURATION_LABELS[band]}
                </option>
              ))}
            </SelectInput>
          </FormField>
        ) : null}

        {subStep === 4 ? (
          <>
            <FormField
              label="Where will you normally train?"
              htmlFor="trainingLocation"
              error={errors.trainingLocation?.message}
            >
              <SelectInput id="trainingLocation" {...register("trainingLocation", { setValueAs: optionalStringValue })}>
                <option value="">—</option>
                {TRAINING_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {TRAINING_LOCATION_LABELS[loc]}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Specific equipment you have access to (optional)" htmlFor="equipmentAccess">
              <Controller
                name="equipmentAccess"
                control={control}
                render={({ field }) => (
                  <TagPicker
                    id="equipmentAccess"
                    suggestions={EQUIPMENT_SUGGESTIONS}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          </>
        ) : null}

        {subStep === 5 ? (
          <>
            <FormField label="Which activities do you prefer?" htmlFor="preferredActivities">
              <Controller
                name="preferredActivities"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {PREFERRED_ACTIVITIES.map((activity) => {
                      const selected = (field.value ?? []).includes(activity);
                      return (
                        <button
                          key={activity}
                          type="button"
                          onClick={() =>
                            field.onChange(
                              selected
                                ? (field.value ?? []).filter((v) => v !== activity)
                                : [...(field.value ?? []), activity]
                            )
                          }
                          className={`${chipBase} ${selected ? chipSelected : chipUnselected}`}
                        >
                          {PREFERRED_ACTIVITY_LABELS[activity]}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </FormField>
            <FormField label="Anything you'd rather avoid? (optional)" htmlFor="dislikedActivities">
              <Controller
                name="dislikedActivities"
                control={control}
                render={({ field }) => (
                  <TagPicker id="dislikedActivities" suggestions={[]} value={field.value ?? []} onChange={field.onChange} />
                )}
              />
            </FormField>
          </>
        ) : null}

        {subStep === 6 ? (
          <>
            <FormField
              label="Do you have any injuries, health conditions, or movement limitations that could affect exercise?"
              htmlFor="injuryStatus"
              error={errors.injuryStatus?.message}
            >
              <SelectInput id="injuryStatus" {...register("injuryStatus", { setValueAs: optionalStringValue })}>
                <option value="">—</option>
                {INJURY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "no" ? "No" : status === "yes" ? "Yes" : "Unsure"}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            {injuryStatus && injuryStatus !== "no" ? (
              <>
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  If you&rsquo;re experiencing any of the following, please get cleared by a healthcare
                  professional before starting a new training program: {PROFESSIONAL_CLEARANCE_RED_FLAGS.join("; ")}.
                </div>
                <FormField label="Which area is affected?" htmlFor="affectedArea">
                  <TextInput id="affectedArea" {...register("affectedArea")} />
                </FormField>
                <FormField label="Which limitations apply?" htmlFor="limitationTags">
                  <Controller
                    name="limitationTags"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {LIMITATION_TAGS.map((tag) => {
                          const selected = (field.value ?? []).includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() =>
                                field.onChange(
                                  selected ? (field.value ?? []).filter((v) => v !== tag) : [...(field.value ?? []), tag]
                                )
                              }
                              className={`${chipBase} ${selected ? chipSelected : chipUnselected}`}
                            >
                              {LIMITATION_TAG_LABELS[tag]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                </FormField>
                <FormField label="Movements to avoid (optional)" htmlFor="prohibitedMovements">
                  <TextArea id="prohibitedMovements" {...register("prohibitedMovements")} />
                </FormField>
                <FormField label="Any clinician-provided restrictions? (optional)" htmlFor="clinicianRestrictions">
                  <TextArea id="clinicianRestrictions" {...register("clinicianRestrictions")} />
                </FormField>
              </>
            ) : null}
          </>
        ) : null}

        {subStep === 7 ? <GoalDetailFields primaryGoal={primaryGoal} register={register} control={control} errors={errors} /> : null}

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <div className="flex gap-3">
          {subStep > 0 ? (
            <Button type="button" variant="secondary" onClick={goBack}>
              Back
            </Button>
          ) : null}
          {subStep < SUB_STEP_COUNT - 1 ? (
            <Button type="button" variant="primary" onClick={goNext} className="flex-1">
              Next
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
              {isPending ? "Saving…" : "Continue"}
            </Button>
          )}
        </div>
      </form>
    </StepShell>
  );
}

/** Q8: branches by primaryGoal, following the brief's per-goal detail
 * question. Kept as one flat `goalDetail` object (see schema.ts) rather
 * than a discriminated union so switching primaryGoal mid-flow doesn't
 * require clearing unrelated fields. */
function GoalDetailFields({
  primaryGoal,
  register,
  control,
  errors,
}: {
  primaryGoal: ExerciseInput["primaryGoal"];
  register: ReturnType<typeof useForm<ExerciseInput>>["register"];
  control: ReturnType<typeof useForm<ExerciseInput>>["control"];
  errors: ReturnType<typeof useForm<ExerciseInput>>["formState"]["errors"];
}) {
  if (!primaryGoal) {
    return <p className="text-sm text-neutral-500">Answer the first question to see this one.</p>;
  }

  if (primaryGoal === "lose_fat") {
    return (
      <>
        <FormField
          label="How much would you like to lose? (optional)"
          htmlFor="goalDetail.desiredFatLossChange"
          hint="e.g. 15 lbs, or a jeans size"
        >
          <TextInput id="goalDetail.desiredFatLossChange" {...register("goalDetail.desiredFatLossChange")} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("goalDetail.noSpecificFatLossAmount")} />
          No specific amount in mind
        </label>
      </>
    );
  }

  if (primaryGoal === "build_muscle") {
    return (
      <>
        <FormField label="Balanced development, or prioritize specific areas?" htmlFor="goalDetail.muscleGainFocus">
          <SelectInput id="goalDetail.muscleGainFocus" {...register("goalDetail.muscleGainFocus", { setValueAs: optionalStringValue })}>
            <option value="">—</option>
            <option value="balanced">Balanced development</option>
            <option value="prioritized_areas">Prioritize specific areas</option>
          </SelectInput>
        </FormField>
        <FormField
          label="Which areas?"
          htmlFor="goalDetail.prioritizedMuscleAreas"
          error={errors.goalDetail?.prioritizedMuscleAreas?.message}
        >
          <Controller
            name="goalDetail.prioritizedMuscleAreas"
            control={control}
            render={({ field }) => (
              <TagPicker
                id="goalDetail.prioritizedMuscleAreas"
                suggestions={["Arms", "Chest", "Back", "Shoulders", "Legs", "Glutes"]}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </>
    );
  }

  if (primaryGoal === "get_stronger") {
    return (
      <FormField label="Which movements matter most to you?" htmlFor="goalDetail.prioritizedMovements">
        <Controller
          name="goalDetail.prioritizedMovements"
          control={control}
          render={({ field }) => (
            <TagPicker
              id="goalDetail.prioritizedMovements"
              suggestions={["Squat", "Bench press", "Deadlift", "Overhead press"]}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>
    );
  }

  if (primaryGoal === "improve_endurance") {
    return (
      <FormField label="Preferred endurance activity" htmlFor="goalDetail.preferredEnduranceActivity">
        <TextInput id="goalDetail.preferredEnduranceActivity" {...register("goalDetail.preferredEnduranceActivity")} />
      </FormField>
    );
  }

  if (primaryGoal === "train_for_event") {
    return (
      <>
        <FormField label="What's the event?" htmlFor="goalDetail.eventType" error={errors.goalDetail?.eventType?.message}>
          <TextInput id="goalDetail.eventType" {...register("goalDetail.eventType")} />
        </FormField>
        <FormField label="Distance (optional)" htmlFor="goalDetail.eventDistance">
          <TextInput id="goalDetail.eventDistance" {...register("goalDetail.eventDistance")} />
        </FormField>
        <FormField label="Event date (optional)" htmlFor="goalDetail.eventDate">
          <TextInput id="goalDetail.eventDate" type="date" {...register("goalDetail.eventDate")} />
        </FormField>
      </>
    );
  }

  // improve_general_fitness / move_and_feel_better
  return (
    <FormField label="What matters most right now?" htmlFor="goalDetail.wellbeingFocusAreas">
      <Controller
        name="goalDetail.wellbeingFocusAreas"
        control={control}
        render={({ field }) => (
          <TagPicker
            id="goalDetail.wellbeingFocusAreas"
            suggestions={["Mobility", "Balance", "Energy", "Stiffness"]}
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />
    </FormField>
  );
}
