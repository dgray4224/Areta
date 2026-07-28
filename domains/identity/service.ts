"use server";

import { identitySchema } from "@/domains/identity/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveIdentityStep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "identity", parsed.data);
  return { ok: true, data: undefined };
}

/** Creates a bare `profiles` row the first time an authenticated user is
 * seen (signup only produces a session after email confirmation, so this
 * can't happen at signUp time — RLS would reject an unauthenticated
 * insert). Idempotent, safe to call on every authenticated request. */
export async function ensureProfile(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to check profile: ${selectError.message}`);
  }

  if (!data) {
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId });
    if (insertError) {
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }
  }
}
