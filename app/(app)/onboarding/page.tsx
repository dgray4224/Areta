import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { firstIncompleteStep } from "@/domains/onboarding/transform";

export default async function OnboardingIndexPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);
  const nextStep = firstIncompleteStep(responses.completedSteps);
  redirect(nextStep ? `/onboarding/${nextStep}` : "/onboarding/review");
}
