import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { stepPosition } from "@/domains/onboarding/transform";
import { CoachingForm } from "./CoachingForm";

export default async function CoachingStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);
  const { stepIndex, totalSteps, backHref } = stepPosition("coaching", responses.goals);

  return (
    <CoachingForm
      userId={user.id}
      defaultValues={responses.coaching ?? {}}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
