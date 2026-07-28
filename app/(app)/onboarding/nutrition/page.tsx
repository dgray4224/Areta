import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { NutritionForm } from "./NutritionForm";

export default async function NutritionStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  return (
    <NutritionForm
      userId={user.id}
      defaultValues={responses.nutrition ?? {}}
      stepIndex={ONBOARDING_STEPS.indexOf("nutrition") + 1}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
