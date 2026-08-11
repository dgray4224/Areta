"use server";

import { createAdminClient } from "@/platform/supabase/admin";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

/**
 * Web counterpart to `app/api/account/delete/route.ts`'s bearer-authed
 * self-service deletion for the mobile Settings -> Account screen. Same
 * underlying operation (`admin.auth.admin.deleteUser`, relying on
 * `profiles.id -> auth.users(id)` being ON DELETE CASCADE per migration
 * 0001 to take everything FK-chained off the profile with it) — not
 * reusing the route itself since web's Settings pages authenticate via
 * session cookies, not a bearer token, and this action's caller already
 * comes from a `requireUser()`-gated page the same way every other
 * Settings action here does (updateProfile, restartOnboarding, etc.).
 *
 * Signs the (still-valid, cookie-bound) session out immediately after
 * the delete succeeds — deleting the auth user doesn't itself clear the
 * browser's session cookie — same as mobile's account.tsx calling
 * `supabase.auth.signOut()` right after its own delete request succeeds.
 */
export async function deleteAccount(userId: string): Promise<ActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, error: error.message };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return { ok: true, data: undefined };
}
