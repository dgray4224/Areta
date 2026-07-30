"use server";

import { coachingSchema } from "@/domains/coaching/schema";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

/** Settings -> Personalization "Coaching" subsection — writes directly to
 * the live `personalization_profiles` row, unlike the old onboarding step
 * which staged answers in `onboarding_responses`. Coaching preferences
 * are no longer an onboarding step (defaults are applied automatically at
 * onboarding-confirm time); this is how a user changes them afterward. */
export async function updatePersonalizationProfile(
  userId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = coachingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("personalization_profiles").upsert(
    {
      user_id: userId,
      tone: parsed.data.tone,
      planning_style: parsed.data.planningStyle,
      reminder_preference: parsed.data.reminderPreference,
      explanation_depth: parsed.data.explanationDepth,
      reschedule_missed_tasks: parsed.data.rescheduleMissedTasks,
      never_recommend: parsed.data.neverRecommend,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
