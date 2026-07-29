import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { stepPosition } from "@/domains/onboarding/transform";
import { GoalsForm } from "./GoalsForm";

export default async function GoalsStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);
  const { stepIndex, totalSteps } = stepPosition("goals", responses.goals);

  return (
    <GoalsForm
      userId={user.id}
      defaultValues={{ goals: responses.goals }}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
    />
  );
}
