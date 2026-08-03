"use server";

import { nutritionSchema } from "@/domains/nutrition/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveNutritionStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = nutritionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "nutrition", parsed.data, client);
  return { ok: true, data: undefined };
}
