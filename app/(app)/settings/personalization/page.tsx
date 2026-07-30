import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import type { CoachingInput } from "@/domains/coaching/schema";
import type { WorkScheduleInput } from "@/domains/identity/schema";
import { PersonalizationForm } from "./PersonalizationForm";

export default async function PersonalizationSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: personalization }, { data: profile }] = await Promise.all([
    supabase
      .from("personalization_profiles")
      .select(
        "tone, planning_style, reminder_preference, explanation_depth, reschedule_missed_tasks, never_recommend"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("work_status, work_hours_note, school_commitments, learning_time_minutes_per_week")
      .eq("id", user.id)
      .single(),
  ]);

  const coachingDefaults: Partial<CoachingInput> = {
    tone: (personalization?.tone as CoachingInput["tone"]) ?? "gentle",
    planningStyle: (personalization?.planning_style as CoachingInput["planningStyle"]) ?? "flexible",
    reminderPreference:
      (personalization?.reminder_preference as CoachingInput["reminderPreference"]) ?? "minimal",
    explanationDepth: (personalization?.explanation_depth as CoachingInput["explanationDepth"]) ?? "brief",
    rescheduleMissedTasks: personalization?.reschedule_missed_tasks ?? true,
    neverRecommend: (personalization?.never_recommend as string[] | null) ?? [],
  };

  const workScheduleDefaults: Partial<WorkScheduleInput> = {
    workStatus: profile?.work_status ?? undefined,
    workHoursNote: profile?.work_hours_note ?? undefined,
    schoolCommitments: profile?.school_commitments ?? undefined,
    learningTimeMinutesPerWeek: profile?.learning_time_minutes_per_week ?? undefined,
  };

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        Everything here is optional. Areta defaults to a gentle, flexible style until you say
        otherwise.
      </p>
      <PersonalizationForm
        userId={user.id}
        coachingDefaults={coachingDefaults}
        workScheduleDefaults={workScheduleDefaults}
      />
    </div>
  );
}
