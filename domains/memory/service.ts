"use server";

import { createMemorySchema, type Memory } from "@/domains/memory/schema";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export async function createMemory(userId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createMemorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: userId,
      type: parsed.data.type,
      content: parsed.data.content,
      evidence: parsed.data.evidence || null,
      confidence: parsed.data.confidence ?? 0.7,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save memory" };
  }
  return { ok: true, data: { id: data.id } };
}

export async function getRecentMemories(userId: string, limit = 20): Promise<Memory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memories")
    .select("id, type, content, evidence, confidence, created_at, last_confirmed_at, review_date, user_confirmed")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load memories: ${error.message}`);
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    type: m.type as Memory["type"],
    content: m.content,
    evidence: m.evidence,
    confidence: m.confidence,
    createdAt: m.created_at,
    lastConfirmedAt: m.last_confirmed_at,
    reviewDate: m.review_date,
    userConfirmed: m.user_confirmed,
  }));
}
