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
