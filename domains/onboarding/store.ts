import "server-only";
import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { OnboardingResponses, OnboardingStepKey } from "@/domains/onboarding/types";

type OnboardingResponsesDbRow = {
  user_id: string;
  identity: OnboardingResponses["identity"];
  goals: OnboardingResponses["goals"];
  nutrition: OnboardingResponses["nutrition"];
  exercise: OnboardingResponses["exercise"];
  recovery: OnboardingResponses["recovery"];
  learning: OnboardingResponses["learning"];
  completed_steps: OnboardingStepKey[];
};

function fromRow(row: OnboardingResponsesDbRow | null, userId: string): OnboardingResponses {
  if (!row) {
    return {
      userId,
      identity: null,
      goals: [],
      nutrition: null,
      exercise: null,
      recovery: null,
      learning: null,
      completedSteps: [],
    };
  }
  return {
    userId: row.user_id,
    identity: row.identity ?? null,
    goals: row.goals ?? [],
    nutrition: row.nutrition ?? null,
    exercise: row.exercise ?? null,
    recovery: row.recovery ?? null,
    learning: row.learning ?? null,
    completedSteps: row.completed_steps ?? [],
  };
}

export async function getOnboardingResponses(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<OnboardingResponses> {
  const supabase = client ?? (await createClient());
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
  data: unknown,
  client?: SupabaseClient<Database>
): Promise<void> {
  const supabase = client ?? (await createClient());
  const existing = await getOnboardingResponses(userId, supabase);
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
