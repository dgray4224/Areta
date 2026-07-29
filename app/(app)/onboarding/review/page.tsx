import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingReview } from "@/domains/onboarding/orchestrator";
import { effectiveSteps } from "@/domains/onboarding/transform";
import { ReviewForm } from "./ReviewForm";

export default async function ReviewStepPage() {
  const user = await requireUser();
  const { responses, output } = await getOnboardingReview(user.id);

  if (!output) {
    redirect("/onboarding");
  }

  const totalSteps = effectiveSteps(responses.goals).length + 1;

  return (
    <ReviewForm
      userId={user.id}
      responses={responses}
      initialOutput={output}
      stepIndex={totalSteps}
      totalSteps={totalSteps}
    />
  );
}
