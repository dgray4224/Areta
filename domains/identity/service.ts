"use server";

import { avatarUrlSchema, identitySchema, workScheduleSchema } from "@/domains/identity/schema";
import { saveOnboardingStep } from "@/domains/onboarding/store";
import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function saveIdentityStep(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await saveOnboardingStep(userId, "identity", parsed.data, client);
  return { ok: true, data: undefined };
}

/** Updates the profile directly (Settings -> Profile), unlike
 * saveIdentityStep which writes to onboarding_responses as an in-progress
 * step answer. This is for a user who has already completed onboarding
 * editing their live settings. */
export async function updateProfile(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      time_zone: parsed.data.timeZone,
      units: parsed.data.units,
      wake_time: parsed.data.wakeTime,
      bed_time: parsed.data.bedTime,
      weekly_review_day: parsed.data.weeklyReviewDay,
      grocery_day: parsed.data.groceryDay,
      meal_prep_day: parsed.data.mealPrepDay,
    })
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Settings -> Personalization "Work & School" subsection — a separate,
 * fully optional partial update on the same `profiles` row as
 * updateProfile, so this can be edited independently of core schedule
 * identity. */
export async function updateWorkSchedule(userId: string, input: unknown): Promise<ActionResult> {
  const parsed = workScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      work_status: parsed.data.workStatus || null,
      work_hours_note: parsed.data.workHoursNote || null,
      school_commitments: parsed.data.schoolCommitments || null,
      learning_time_minutes_per_week: parsed.data.learningTimeMinutesPerWeek ?? null,
    })
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Settings -> Profile avatar upload. Web counterpart to areta-mobile's
 * lib/avatar-upload.ts: same fixed `${userId}/avatar.jpg` path with
 * upsert:true (re-uploading overwrites in place instead of accumulating
 * orphaned old photos in the `avatars` bucket — migration
 * 20260809180500), same public-URL-plus-cache-busting-query-string
 * return shape. Runs server-side (unlike mobile, which uploads directly
 * from the device) since this app already routes all mutations through
 * "use server" actions rather than exposing Storage writes to a client
 * Supabase instance — the server client here still carries the caller's
 * session cookies, so the bucket's `auth.uid()`-scoped RLS policies
 * apply exactly as they would to a direct client-side upload. */
export async function uploadAvatar(userId: string, formData: FormData): Promise<ActionResult<{ avatarUrl: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided" };
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, error: "Photo must be a JPEG, PNG, or WebP image" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Photo must be smaller than 5MB" };
  }

  const supabase = await createClient();
  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return { ok: false, error: `Failed to upload photo: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${publicUrl}?updated=${Date.now()}`;

  const parsed = avatarUrlSchema.safeParse({ avatarUrl });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid photo URL" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq("id", userId);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, data: { avatarUrl: parsed.data.avatarUrl } };
}

/** Creates a bare `profiles` row the first time an authenticated user is
 * seen (signup only produces a session after email confirmation, so this
 * can't happen at signUp time — RLS would reject an unauthenticated
 * insert). Idempotent, safe to call on every authenticated request. */
export async function ensureProfile(userId: string, client?: SupabaseClient<Database>): Promise<void> {
  const supabase = client ?? (await createClient());
  const { data, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to check profile: ${selectError.message}`);
  }

  if (!data) {
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId });
    if (insertError) {
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }
  }
}
