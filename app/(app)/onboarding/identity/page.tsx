import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { stepPosition } from "@/domains/onboarding/transform";
import { IdentityForm } from "./IdentityForm";

export default async function IdentityStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);
  const { stepIndex, totalSteps } = stepPosition("identity", responses.goals);

  return (
    <IdentityForm
      userId={user.id}
      defaultValues={responses.identity ?? {}}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
    />
  );
}
