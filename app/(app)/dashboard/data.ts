import "server-only";
import { createClient } from "@/platform/supabase/server";
import { recommendNextAction } from "@/domains/tasks/recommend";
import type { TaskStatus } from "@/domains/tasks/schema";

export type TodayTask = {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  priority: number | null;
  status: TaskStatus;
  skipReason: string | null;
};

export type DashboardData = {
  profile: {
    fullName: string | null;
    onboardingCompletedAt: string | null;
  };
  domains: { key: string; label: string }[];
  goals: { id: string; outcome: string; targetDate: string | null; priority: number | null }[];
  currentPhase: { name: string; mission: string | null } | null;
  weeklyOutcomes: { outcomeText: string }[];
  today: string;
  todayTasks: TodayTask[];
  taskProgress: { completed: number; total: number };
  recommendedNextAction: string | null;
  logsToday: {
    weightLogged: boolean;
    sleepLogged: boolean;
    nutritionEntries: number;
    recoveryLogged: boolean;
    learningMinutes: number;
  };
};

/** Server's current date as YYYY-MM-DD. A more correct implementation
 * would convert to the user's profile.time_zone; this UTC-based
 * simplification is a known Phase 2 gap (see README). */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayDateString();

  const [
    { data: profile },
    { data: domains },
    { data: goals },
    { data: phases },
    { data: weeklyOutcomes },
    { data: tasks },
    { data: weightLogsToday },
    { data: sleepLogsToday },
    { data: nutritionLogsToday },
    { data: recoveryLogsToday },
    { data: studySessionsToday },
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
    supabase
      .from("daily_actions")
      .select("id, title, description, is_required, priority, status, skip_reason")
      .eq("user_id", userId)
      .eq("date", today)
      .order("priority", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("weight_logs")
      .select("id")
      .eq("user_id", userId)
      .gte("logged_at", `${today}T00:00:00.000Z`)
      .lte("logged_at", `${today}T23:59:59.999Z`),
    supabase.from("sleep_logs").select("id").eq("user_id", userId).eq("date", today),
    supabase.from("nutrition_logs").select("id").eq("user_id", userId).eq("date", today),
    supabase.from("recovery_logs").select("id").eq("user_id", userId).eq("date", today),
    supabase.from("study_sessions").select("duration_minutes").eq("user_id", userId).eq("date", today),
  ]);

  const todayTasks: TodayTask[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    isRequired: t.is_required,
    priority: t.priority,
    status: t.status as TaskStatus,
    skipReason: t.skip_reason,
  }));

  const completed = todayTasks.filter(
    (t) => t.status === "completed" || t.status === "partially_completed"
  ).length;

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
    today,
    todayTasks,
    taskProgress: { completed, total: todayTasks.length },
    recommendedNextAction: recommendNextAction(todayTasks),
    logsToday: {
      weightLogged: (weightLogsToday ?? []).length > 0,
      sleepLogged: (sleepLogsToday ?? []).length > 0,
      nutritionEntries: (nutritionLogsToday ?? []).length,
      recoveryLogged: (recoveryLogsToday ?? []).length > 0,
      learningMinutes: (studySessionsToday ?? []).reduce(
        (sum, s) => sum + (s.duration_minutes ?? 0),
        0
      ),
    },
  };
}
