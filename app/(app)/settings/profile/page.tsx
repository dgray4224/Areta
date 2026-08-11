import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import type { IdentityInput } from "@/domains/identity/schema";
import { AvatarUpload } from "./AvatarUpload";
import { ProfileForm } from "./ProfileForm";

function trimSeconds(time: string | null): string | undefined {
  return time ? time.slice(0, 5) : undefined;
}

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, time_zone, units, wake_time, bed_time, weekly_review_day, grocery_day, meal_prep_day"
    )
    .eq("id", user.id)
    .single();

  const defaultValues: Partial<IdentityInput> = {
    fullName: profile?.full_name ?? undefined,
    timeZone: profile?.time_zone ?? undefined,
    units: (profile?.units as IdentityInput["units"]) ?? undefined,
    wakeTime: trimSeconds(profile?.wake_time ?? null),
    bedTime: trimSeconds(profile?.bed_time ?? null),
    weeklyReviewDay: profile?.weekly_review_day ?? undefined,
    groceryDay: profile?.grocery_day ?? undefined,
    mealPrepDay: profile?.meal_prep_day ?? undefined,
  };

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        The basics Areta plans around — same fields you answered during onboarding.
      </p>
      <AvatarUpload userId={user.id} initialUrl={profile?.avatar_url ?? null} />
      <ProfileForm userId={user.id} defaultValues={defaultValues} />
    </div>
  );
}
