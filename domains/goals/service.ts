"use server";

import { goalsStepSchema } from "@/domains/goals/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveGoalsStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = goalsStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "goals", parsed.data.goals, client);
  return { ok: true, data: undefined };
}
