"use server";

import { learningSchema } from "@/domains/learning/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveLearningStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = learningSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "learning", parsed.data, client);
  return { ok: true, data: undefined };
}
