import { requireUser } from "@/platform/auth/session";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_SCREENS } from "@/domains/onboarding/types";
import { GoalsForm } from "./GoalsForm";

export default async function GoalsStepPage() {
  const user = await requireUser();
  const responses = await getOnboardingResponses(user.id);

  return (
    <GoalsForm
      userId={user.id}
      defaultValues={{
        goals:
          responses.goals.length > 0
            ? responses.goals
            : [
                {
                  domainKey: "general",
                  outcome: "",
                  why: "",
                  targetDate: "",
                  startingState: "",
                  constraints: "",
                  successCriteria: "",
                  priority: 3,
                  confidence: 3,
                  knownObstacles: "",
                },
              ],
      }}
      stepIndex={ONBOARDING_STEPS.indexOf("goals") + 1}
      totalSteps={TOTAL_ONBOARDING_SCREENS}
    />
  );
}
