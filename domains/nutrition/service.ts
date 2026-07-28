"use server";

import { nutritionSchema } from "@/domains/nutrition/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveNutritionStep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = nutritionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "nutrition", parsed.data);
  return { ok: true, data: undefined };
}
