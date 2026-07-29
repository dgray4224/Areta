"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

/**
 * Clears everything derived from onboarding — raw answers, goals, phases,
 * domains, weekly outcomes, personalization profile, daily check-in
 * fields — and un-marks the profile as onboarded, so `/onboarding`
 * (CLAUDE.md Phase 1) starts fresh at step one.
 *
 * Deliberately scoped to onboarding-derived data only: logged activity
 * (weight/sleep/nutrition/recovery/learning logs), meal plans, weekly
 * reviews, and generated nutrition parameters are untouched — "start
 * over on the interview" isn't "delete my history." Every FK from other
 * tables into goals/domains (daily_actions, weekly_outcomes) is
 * ON DELETE SET NULL, so nothing else is orphaned or destroyed.
 */
export async function restartOnboarding(userId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const deletions = await Promise.all([
    supabase.from("weekly_outcomes").delete().eq("user_id", userId),
    supabase.from("phases").delete().eq("user_id", userId),
    supabase.from("goals").delete().eq("user_id", userId),
    supabase.from("domains").delete().eq("user_id", userId),
    supabase.from("personalization_profiles").delete().eq("user_id", userId),
    supabase.from("daily_checkin_fields").delete().eq("user_id", userId),
    supabase.from("onboarding_responses").delete().eq("user_id", userId),
  ]);

  const failed = deletions.find((d) => d.error);
  if (failed?.error) {
    return { ok: false, error: `Failed to clear onboarding data: ${failed.error.message}` };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: null })
    .eq("id", userId);

  if (profileError) {
    return { ok: false, error: `Failed to reset profile: ${profileError.message}` };
  }

  return { ok: true, data: undefined };
}
