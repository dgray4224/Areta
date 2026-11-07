import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

/**
 * Kept out of service.ts on purpose: that file is "use server", so every
 * export there becomes a client-callable server action, and it may export
 * only async functions. A consent lookup that takes any user id must not
 * be callable from a browser.
 */

/** Error generateWeeklyBrief returns when the person hasn't agreed to
 * the AI provider seeing their data. Callers match on it to skip
 * quietly rather than count it as a failure. */
export const AI_CONSENT_REQUIRED = "AI consent not given";

/**
 * True only when the person has explicitly agreed to have their data sent
 * to the AI provider (profiles.ai_consent, App Store guideline 5.1.2(i)).
 * Never asked and declined both read as no: the brief is the only thing
 * that sends a person's own data to the model, and it must not go
 * without a yes.
 */
export async function hasAiConsent(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("ai_consent").eq("id", userId).maybeSingle();
  return data?.ai_consent === true;
}
