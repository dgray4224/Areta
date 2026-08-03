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

  const steps = effectiveSteps(responses.goals, responses.exercise);
  const totalSteps = steps.length + 1;
  const backHref = steps.length > 0 ? `/onboarding/${steps[steps.length - 1]}` : undefined;

  return (
    <ReviewForm
      userId={user.id}
      responses={responses}
      initialOutput={output}
      stepIndex={totalSteps}
      totalSteps={totalSteps}
      backHref={backHref}
    />
  );
}
