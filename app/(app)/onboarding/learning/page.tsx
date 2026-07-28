import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { LearningForm } from "./LearningForm";

export default async function LearningStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  return (
    <LearningForm
      userId={user.id}
      defaultValues={responses.learning ?? {}}
      stepIndex={ONBOARDING_STEPS.indexOf("learning") + 1}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
