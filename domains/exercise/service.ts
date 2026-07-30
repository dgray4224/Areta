"use server";

import { exerciseSchema, exerciseLogSchema } from "@/domains/exercise/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveExerciseStep(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "exercise", parsed.data);
  return { ok: true, data: undefined };
}

export async function logExercise(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = exerciseLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("exercise_logs").insert({
    user_id: userId,
    date: d.date,
    archetype: d.archetype ?? null,
    duration_minutes: d.durationMinutes ?? null,
    perceived_exertion: d.perceivedExertion ?? null,
    notes: d.notes || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getRecentExerciseLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("id, date, archetype, duration_minutes, perceived_exertion, notes")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load exercise logs: ${error.message}`);
  }
  return data ?? [];
}
