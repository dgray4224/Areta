import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import type { User } from "@supabase/supabase-js";

export type TrainerSession = { user: User };

/** Non-redirecting read, same shape as getAdminStatus — for the regular
 * app shell (Settings nav) where a non-trainer should just see nothing
 * extra, not get bounced. */
export async function getTrainerStatus(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("is_trainer").eq("id", userId).maybeSingle();
  return data?.is_trainer ?? false;
}

/** Use at the top of any Server Component under `app/(trainer)`. Not the
 * same gate as requireAdmin() — is_trainer is a different axis entirely
 * (access to specific *other customers'* data via trainer_clients, not
 * access to this internal admin tool). A non-trainer landing here gets
 * bounced to /dashboard, same "just go home" pattern as requireAdmin(). */
export async function requireTrainer(): Promise<TrainerSession> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("is_trainer").eq("id", user.id).maybeSingle();

  if (!profile?.is_trainer) {
    redirect("/dashboard");
  }

  return { user };
}
