"use server";

import { createTaskSchema, updateTaskStatusSchema } from "@/domains/tasks/schema";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export async function createTask(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();

  let domainId: string | null = null;
  if (parsed.data.domainKey) {
    const { data } = await supabase
      .from("domains")
      .select("id")
      .eq("user_id", userId)
      .eq("key", parsed.data.domainKey)
      .maybeSingle();
    domainId = data?.id ?? null;
  }

  const { error } = await supabase.from("daily_actions").insert({
    user_id: userId,
    date: parsed.data.date,
    title: parsed.data.title,
    description: parsed.data.description || null,
    is_required: parsed.data.isRequired,
    priority: parsed.data.priority ?? null,
    domain_id: domainId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Updates the task's current status and appends the transition to
 * action_events (CLAUDE.md §7 Layer 2 "preserve history"). */
export async function updateTaskStatus(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("daily_actions")
    .select("status")
    .eq("id", parsed.data.taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: fetchError?.message ?? "Task not found" };
  }

  const skipReason = parsed.data.status === "skipped" ? parsed.data.skipReason || null : null;

  const { error: updateError } = await supabase
    .from("daily_actions")
    .update({ status: parsed.data.status, skip_reason: skipReason })
    .eq("id", parsed.data.taskId)
    .eq("user_id", userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { error: eventError } = await supabase.from("action_events").insert({
    user_id: userId,
    action_id: parsed.data.taskId,
    from_status: existing.status,
    to_status: parsed.data.status,
    reason: skipReason,
  });

  if (eventError) {
    return { ok: false, error: eventError.message };
  }
  return { ok: true, data: undefined };
}

export async function getTasksForDate(userId: string, date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_actions")
    .select("id, title, description, is_required, priority, status, skip_reason, domain_id")
    .eq("user_id", userId)
    .eq("date", date)
    .order("priority", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }
  return data ?? [];
}

export type DailyTaskCompletion = { date: string; completionPercent: number; total: number };

export async function getTaskCompletionByDay(
  userId: string,
  days = 30
): Promise<DailyTaskCompletion[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceIso = since.toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_actions")
    .select("date, status")
    .eq("user_id", userId)
    .gte("date", sinceIso);

  if (error) {
    throw new Error(`Failed to load task completion: ${error.message}`);
  }

  const byDate = new Map<string, { completed: number; total: number }>();
  for (const row of data ?? []) {
    const existing = byDate.get(row.date) ?? { completed: 0, total: 0 };
    existing.total += 1;
    if (row.status === "completed" || row.status === "partially_completed") {
      existing.completed += 1;
    }
    byDate.set(row.date, existing);
  }

  return Array.from(byDate.entries())
    .map(([date, { completed, total }]) => ({
      date,
      total,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
