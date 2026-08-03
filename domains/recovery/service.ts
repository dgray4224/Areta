"use server";

import { recoverySchema, skippedRecovery } from "@/domains/recovery/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveRecoveryStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "recovery", parsed.data, client);
  return { ok: true, data: undefined };
}

export async function skipRecoveryStep(userId: string, client?: SupabaseClient<Database>): Promise<ActionResult> {
  await saveOnboardingStep(userId, "recovery", skippedRecovery, client);
  return { ok: true, data: undefined };
}
