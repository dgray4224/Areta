"use server";

import { weightLogSchema } from "@/domains/weight/schema";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export async function logWeight(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = weightLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("weight_logs").insert({
    user_id: userId,
    logged_at: new Date(parsed.data.loggedAt).toISOString(),
    weight: parsed.data.weight,
    unit: parsed.data.unit,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getRecentWeightLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weight_logs")
    .select("id, logged_at, weight, unit, notes")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load weight logs: ${error.message}`);
  }
  return data ?? [];
}
