import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { effectiveSteps, stepPosition } from "@/domains/onboarding/transform";
import { RecoveryForm } from "./RecoveryForm";

export default async function RecoveryStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  if (!effectiveSteps(responses.goals).includes("recovery")) {
    redirect("/onboarding");
  }

  const { stepIndex, totalSteps, backHref } = stepPosition("recovery", responses.goals);

  return (
    <RecoveryForm
      userId={user.id}
      defaultValues={responses.recovery ?? { skipped: false }}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
