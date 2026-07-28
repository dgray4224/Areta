import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingReview } from "@/domains/onboarding/orchestrator";
import { TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { ReviewForm } from "./ReviewForm";

export default async function ReviewStepPage() {
  const user = await requireUser();
  const { responses, output } = await getOnboardingReview(user.id);

  if (!output) {
    redirect("/onboarding");
  }

  return (
    <ReviewForm
      userId={user.id}
      responses={responses}
      initialOutput={output}
      stepIndex={TOTAL_ONBOARDING_SCREENS}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
