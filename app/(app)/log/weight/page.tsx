import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { WeightLogForm } from "./WeightLogForm";

export default async function WeightLogPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("units")
    .eq("id", user.id)
    .maybeSingle();

  const defaultUnit = profile?.units === "metric" ? "kg" : "lb";

  return <WeightLogForm userId={user.id} defaultUnit={defaultUnit} />;
}
