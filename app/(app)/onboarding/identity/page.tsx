import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { IdentityForm } from "./IdentityForm";

export default async function IdentityStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  return (
    <IdentityForm
      userId={user.id}
      defaultValues={responses.identity ?? {}}
      stepIndex={ONBOARDING_STEPS.indexOf("identity") + 1}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
