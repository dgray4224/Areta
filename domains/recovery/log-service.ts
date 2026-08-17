"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { recoveryLogSchema } from "@/domains/recovery/log-schema";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

/** `client` is supplied by the mobile bearer route (/api/log/recovery);
 * see domains/weight/service.ts#logWeight for why the cookie-bound
 * default can't serve a native app. */
export async function logRecovery(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = recoveryLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("recovery_logs").insert({
    user_id: userId,
    date: d.date,
    pain: d.pain ?? null,
    swelling: d.swelling ?? null,
    energy: d.energy ?? null,
    brace_compliance: d.braceCompliance ?? null,
    medication_adherence: d.medicationAdherence ?? null,
    elevation: d.elevation ?? null,
    ice: d.ice ?? null,
    approved_exercises: d.approvedExercises || null,
    mobility: d.mobility || null,
    warning_signs: d.warningSigns,
    warning_signs_notes: d.warningSignsNotes || null,
    notes: d.notes || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getRecentRecoveryLogs(userId: string, limit = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recovery_logs")
    .select(
      "id, date, pain, swelling, energy, brace_compliance, medication_adherence, elevation, ice, approved_exercises, mobility, warning_signs, warning_signs_notes, notes"
    )
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load recovery logs: ${error.message}`);
  }
  return data ?? [];
}
