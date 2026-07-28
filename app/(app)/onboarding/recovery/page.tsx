import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { RecoveryForm } from "./RecoveryForm";

export default async function RecoveryStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  return (
    <RecoveryForm
      userId={user.id}
      defaultValues={responses.recovery ?? { skipped: false }}
      stepIndex={ONBOARDING_STEPS.indexOf("recovery") + 1}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
