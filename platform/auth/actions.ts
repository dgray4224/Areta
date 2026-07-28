"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/platform/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<ActionResult<{ requiresEmailConfirmation: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

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

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
