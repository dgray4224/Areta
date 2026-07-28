"use server";

import { coachingSchema } from "@/domains/coaching/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveCoachingStep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = coachingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "coaching", parsed.data);
  return { ok: true, data: undefined };
}
