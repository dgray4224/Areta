"use server";

import { recoverySchema, skippedRecovery } from "@/domains/recovery/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveRecoveryStep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "recovery", parsed.data);
  return { ok: true, data: undefined };
}

export async function skipRecoveryStep(userId: string): Promise<ActionResult> {
  await saveOnboardingStep(userId, "recovery", skippedRecovery);
  return { ok: true, data: undefined };
}
