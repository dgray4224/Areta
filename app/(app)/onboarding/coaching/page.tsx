import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { CoachingForm } from "./CoachingForm";

export default async function CoachingStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  return (
    <CoachingForm
      userId={user.id}
      defaultValues={responses.coaching ?? {}}
      stepIndex={ONBOARDING_STEPS.indexOf("coaching") + 1}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
