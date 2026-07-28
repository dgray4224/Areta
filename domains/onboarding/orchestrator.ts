"use server";

import { createClient } from "@/platform/supabase/server";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { transformOnboarding, firstIncompleteStep } from "@/domains/onboarding/transform";
import { writeOnboardingOutput } from "@/domains/onboarding/write-output";
import type { OnboardingOutput, OnboardingResponses } from "@/domains/onboarding/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function getOnboardingReview(
  userId: string
): Promise<{ responses: OnboardingResponses; output: OnboardingOutput | null }> {
  const responses = await getOnboardingResponses(userId);
  const allStepsDone = firstIncompleteStep(responses.completedSteps) === null;
  const output = allStepsDone ? transformOnboarding(responses) : null;
  return { responses, output };
}

/** Server Action entry point used by the review screen — creates the
 * request-scoped (cookie-bound, RLS-as-the-user) client and delegates the
 * actual multi-table write to `writeOnboardingOutput`. */
export async function confirmOnboarding(
  userId: string,
  responses: OnboardingResponses,
  output: OnboardingOutput
): Promise<ActionResult> {
  const supabase = await createClient();
  return writeOnboardingOutput(supabase, userId, responses, output);
}
