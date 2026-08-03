import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { effectiveSteps, stepPosition } from "@/domains/onboarding/transform";
import { ExerciseForm } from "./ExerciseForm";

export default async function ExerciseStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  if (!effectiveSteps(responses.goals, responses.exercise).includes("exercise")) {
    redirect("/onboarding");
  }

  const { stepIndex, totalSteps, backHref } = stepPosition("exercise", responses.goals, responses.exercise);

  return (
    <ExerciseForm
      userId={user.id}
      defaultValues={responses.exercise ?? {}}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
