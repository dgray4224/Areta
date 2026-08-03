import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { effectiveSteps, stepPosition } from "@/domains/onboarding/transform";
import { LearningForm } from "./LearningForm";

export default async function LearningStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  if (!effectiveSteps(responses.goals, responses.exercise).includes("learning")) {
    redirect("/onboarding");
  }

  const { stepIndex, totalSteps, backHref } = stepPosition("learning", responses.goals, responses.exercise);

  return (
    <LearningForm
      userId={user.id}
      defaultValues={responses.learning ?? {}}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
