"use server";

import { goalsStepSchema } from "@/domains/goals/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveGoalsStep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = goalsStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "goals", parsed.data.goals);
  return { ok: true, data: undefined };
}
