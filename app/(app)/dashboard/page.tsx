import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { getActiveSections } from "@/platform/ui/sections";

/** Thin redirect to the user's first active Section (mirrors the
 * onboarding index's resume-to-the-right-place pattern). V1 only ever has
 * "health" active, but this stays generic as more sections activate. */
export default async function DashboardIndexPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const { data: domains } = await supabase
    .from("domains")
    .select("key")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const activeSections = getActiveSections((domains ?? []).map((d) => d.key));
  redirect(`/dashboard/${activeSections[0] ?? "health"}`);
}
