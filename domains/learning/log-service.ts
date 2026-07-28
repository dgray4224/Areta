"use server";

import { studySessionSchema } from "@/domains/learning/log-schema";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export async function logStudySession(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = studySessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    date: d.date,
    track: d.track || null,
    task: d.task,
    duration_minutes: d.durationMinutes ?? null,
    focus: d.focus ?? null,
    output: d.output || null,
    link: d.link || null,
    reflection: d.reflection || null,
    next_step: d.nextStep || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getRecentStudySessions(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("id, date, track, task, duration_minutes, focus, output, link, reflection, next_step")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load study sessions: ${error.message}`);
  }
  return data ?? [];
}
