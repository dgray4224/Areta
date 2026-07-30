"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { PROMPT_TRIGGERS, type TriggerInput } from "@/domains/prompts/triggers";
import { todayIso } from "@/domains/review/dates";

const COOLDOWN_DAYS = 7;
const LOOKBACK_DAYS = 7;
const SLEEP_LOOKBACK_DAYS = 5;

export type ActivePrompt = {
  triggerId: string;
  question: string;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getActivePrompt(userId: string): Promise<ActivePrompt | null> {
  const supabase = await createClient();
  const today = todayIso();
  const lookbackStart = daysAgoIso(LOOKBACK_DAYS);
  const sleepLookbackStart = daysAgoIso(SLEEP_LOOKBACK_DAYS);
  const cooldownStart = new Date();
  cooldownStart.setUTCDate(cooldownStart.getUTCDate() - COOLDOWN_DAYS);

  const [
    { data: goals },
    { data: domains },
    { data: exerciseLogs },
    { data: sleepLogs },
    { data: skippedTasks },
    { data: recentPromptEvents },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("target_date, domains(key)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("domains").select("key").eq("user_id", userId).eq("is_active", true),
    supabase
      .from("exercise_logs")
      .select("id")
      .eq("user_id", userId)
      .gte("date", lookbackStart)
      .limit(1),
    supabase
      .from("sleep_logs")
      .select("total_duration_minutes")
      .eq("user_id", userId)
      .gte("date", sleepLookbackStart)
      .order("date", { ascending: false }),
    supabase
      .from("daily_actions")
      .select("domains(key)")
      .eq("user_id", userId)
      .eq("is_required", true)
      .eq("status", "skipped")
      .gte("date", lookbackStart),
    supabase
      .from("prompt_events")
      .select("trigger_id")
      .eq("user_id", userId)
      .gte("shown_at", cooldownStart.toISOString()),
  ]);

  const skippedRequiredTaskCountByDomain: Record<string, number> = {};
  for (const task of skippedTasks ?? []) {
    const key = (task.domains as unknown as { key: string } | null)?.key;
    if (!key) continue;
    skippedRequiredTaskCountByDomain[key] = (skippedRequiredTaskCountByDomain[key] ?? 0) + 1;
  }

  const input: TriggerInput = {
    today,
    activeGoals: (goals ?? []).map((g) => ({
      domainKey: (g.domains as unknown as { key: string } | null)?.key ?? "general",
      targetDate: g.target_date,
    })),
    activeDomains: (domains ?? []).map((d) => d.key),
    hasRecentExerciseLog: (exerciseLogs ?? []).length > 0,
    recentSleepDurationsMinutes: (sleepLogs ?? [])
      .map((s) => s.total_duration_minutes)
      .filter((m): m is number => m !== null),
    skippedRequiredTaskCountByDomain,
  };

  const triggersOnCooldown = new Set((recentPromptEvents ?? []).map((e) => e.trigger_id));

  for (const trigger of PROMPT_TRIGGERS) {
    if (triggersOnCooldown.has(trigger.id)) continue;
    const question = trigger.evaluate(input);
    if (question) {
      return { triggerId: trigger.id, question };
    }
  }

  return null;
}

export async function answerPrompt(
  userId: string,
  triggerId: string,
  answerText: string
): Promise<ActionResult> {
  const trigger = PROMPT_TRIGGERS.find((t) => t.id === triggerId);
  if (!trigger) {
    return { ok: false, error: "Unknown prompt" };
  }
  const trimmed = answerText.trim();
  if (!trimmed) {
    return { ok: false, error: "Answer can't be empty" };
  }

  const supabase = await createClient();
  const { data: memory, error: memoryError } = await supabase
    .from("memories")
    .insert({
      user_id: userId,
      type: trigger.memoryType,
      content: trimmed,
      evidence: `Answered contextual prompt "${triggerId}"`,
    })
    .select("id")
    .single();

  if (memoryError || !memory) {
    return { ok: false, error: memoryError?.message ?? "Failed to save answer" };
  }

  const { error } = await supabase.from("prompt_events").insert({
    user_id: userId,
    trigger_id: triggerId,
    answered: true,
    memory_id: memory.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function dismissPrompt(userId: string, triggerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("prompt_events").insert({
    user_id: userId,
    trigger_id: triggerId,
    dismissed: true,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
