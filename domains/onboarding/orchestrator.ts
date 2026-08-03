"use server";

import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { getOnboardingResponses } from "@/domains/onboarding/store";
import { transformOnboarding, firstIncompleteStep } from "@/domains/onboarding/transform";
import { writeOnboardingOutput } from "@/domains/onboarding/write-output";
import type { OnboardingOutput, OnboardingResponses } from "@/domains/onboarding/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function getOnboardingReview(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<{ responses: OnboardingResponses; output: OnboardingOutput | null }> {
  const responses = await getOnboardingResponses(userId, client);
  const allStepsDone = firstIncompleteStep(responses) === null;
  const output = allStepsDone ? transformOnboarding(responses) : null;
  return { responses, output };
}

/** Server Action entry point used by the review screen — creates the
 * request-scoped (cookie-bound, RLS-as-the-user) client by default, or
 * uses the caller's own client (e.g. a bearer-scoped one for mobile's
 * app/api/onboarding/confirm route) and delegates the actual multi-table
 * write to `writeOnboardingOutput`. */
export async function confirmOnboarding(
  userId: string,
  responses: OnboardingResponses,
  output: OnboardingOutput,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  return writeOnboardingOutput(supabase, userId, responses, output);
}
