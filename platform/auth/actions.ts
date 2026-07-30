"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/platform/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<ActionResult<{ requiresEmailConfirmation: boolean }>> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Without custom SMTP, the hosted project can only use Supabase's default
  // confirmation email template — but that template's link still honors
  // emailRedirectTo, so our own /auth/confirm route runs after Supabase
  // verifies the token without needing to touch the template at all.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/confirm?next=/onboarding` : undefined,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // With email confirmation enabled, signUp returns a user but no session.
  const requiresEmailConfirmation = data.session === null;
  return { ok: true, data: { requiresEmailConfirmation } };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}

/** Always returns ok, even if no account matches — Supabase doesn't
 * distinguish "sent" from "no such user" in its response, and neither
 * should we, so this can't be used to enumerate registered emails. */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/auth/confirm?next=/reset-password` : undefined,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Only succeeds with a valid recovery session — established by clicking
 * the email link from requestPasswordReset, which lands on /auth/confirm
 * and exchanges the code for a session before redirecting here. */
export async function updatePassword(password: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
