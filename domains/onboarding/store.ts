import "server-only";
import { createClient } from "@/platform/supabase/server";
import type { OnboardingResponses, OnboardingStepKey } from "@/domains/onboarding/types";

type OnboardingResponsesDbRow = {
  user_id: string;
  identity: OnboardingResponses["identity"];
  goals: OnboardingResponses["goals"];
  nutrition: OnboardingResponses["nutrition"];
  recovery: OnboardingResponses["recovery"];
  learning: OnboardingResponses["learning"];
  coaching: OnboardingResponses["coaching"];
  completed_steps: OnboardingStepKey[];
};

function fromRow(row: OnboardingResponsesDbRow | null, userId: string): OnboardingResponses {
  if (!row) {
    return {
      userId,
      identity: null,
      goals: [],
      nutrition: null,
      recovery: null,
      learning: null,
      coaching: null,
      completedSteps: [],
    };
  }
  return {
    userId: row.user_id,
    identity: row.identity ?? null,
    goals: row.goals ?? [],
    nutrition: row.nutrition ?? null,
    recovery: row.recovery ?? null,
    learning: row.learning ?? null,
    coaching: row.coaching ?? null,
    completedSteps: row.completed_steps ?? [],
  };
}

export async function getOnboardingResponses(userId: string): Promise<OnboardingResponses> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load onboarding responses: ${error.message}`);
  }

  return fromRow(data as OnboardingResponsesDbRow | null, userId);
}

/** Upserts one step's answers as a JSONB column and marks the step
 * complete. Steps can be resubmitted (editing a previous step keeps it
 * marked complete rather than reverting progress). */
export async function saveOnboardingStep(
  userId: string,
  step: OnboardingStepKey,
  data: unknown
): Promise<void> {
  const supabase = await createClient();
  const existing = await getOnboardingResponses(userId);
  const completedSteps = existing.completedSteps.includes(step)
    ? existing.completedSteps
    : [...existing.completedSteps, step];

  // Supabase's generated Update/Insert types reject a computed [step] key
  // (they can't statically verify it against the known column list), so
  // the payload is built as a loose record and cast at the boundary.
  const payload: Record<string, unknown> = {
    user_id: userId,
    completed_steps: completedSteps,
    [step]: data,
  };

  const { error } = await supabase
    .from("onboarding_responses")
    .upsert(payload as never, { onConflict: "user_id" });

  if (error) {
    throw new Error(`Failed to save onboarding step "${step}": ${error.message}`);
  }
}
