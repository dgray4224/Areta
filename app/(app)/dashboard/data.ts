import "server-only";
import { createClient } from "@/platform/supabase/server";

export type DashboardData = {
  profile: {
    fullName: string | null;
    onboardingCompletedAt: string | null;
  };
  domains: { key: string; label: string }[];
  goals: { id: string; outcome: string; targetDate: string | null; priority: number | null }[];
  currentPhase: { name: string; mission: string | null } | null;
  weeklyOutcomes: { outcomeText: string }[];
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const [
    { data: profile },
    { data: domains },
    { data: goals },
    { data: phases },
    { data: weeklyOutcomes },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, onboarding_completed_at").eq("id", userId).maybeSingle(),
    supabase.from("domains").select("key, label").eq("user_id", userId).eq("is_active", true),
    supabase
      .from("goals")
      .select("id, outcome, target_date, priority")
      .eq("user_id", userId)
      .order("priority", { ascending: true }),
    supabase
      .from("phases")
      .select("name, mission")
      .eq("user_id", userId)
      .eq("is_current", true)
      .limit(1),
    supabase
      .from("weekly_outcomes")
      .select("outcome_text")
      .eq("user_id", userId)
      .eq("status", "proposed"),
  ]);

  return {
    profile: {
      fullName: profile?.full_name ?? null,
      onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
    },
    domains: domains ?? [],
    goals: (goals ?? []).map((g) => ({
      id: g.id,
      outcome: g.outcome,
      targetDate: g.target_date,
      priority: g.priority,
    })),
    currentPhase:
      phases && phases.length > 0 ? { name: phases[0].name, mission: phases[0].mission } : null,
    weeklyOutcomes: (weeklyOutcomes ?? []).map((w) => ({ outcomeText: w.outcome_text })),
  };
}
