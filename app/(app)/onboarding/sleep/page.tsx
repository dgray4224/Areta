import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { effectiveSteps, stepPosition } from "@/domains/onboarding/transform";
import { SleepForm } from "./SleepForm";

export default async function SleepStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  if (!effectiveSteps(responses.goals).includes("sleep")) {
    redirect("/onboarding");
  }

  const { stepIndex, totalSteps, backHref } = stepPosition("sleep", responses.goals);

  return (
    <SleepForm
      userId={user.id}
      defaultValues={responses.sleepGoals ?? {}}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
