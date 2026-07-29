import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { effectiveSteps, stepPosition } from "@/domains/onboarding/transform";
import { NutritionForm } from "./NutritionForm";

export default async function NutritionStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  if (!effectiveSteps(responses.goals).includes("nutrition")) {
    redirect("/onboarding");
  }

  const { stepIndex, totalSteps, backHref } = stepPosition("nutrition", responses.goals);

  return (
    <NutritionForm
      userId={user.id}
      defaultValues={responses.nutrition ?? {}}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
