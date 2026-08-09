import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { createAdminClient } from "@/platform/supabase/admin";

/**
 * Self-service account deletion for the mobile Settings -> Account screen.
 * Deliberately separate from domains/users/service.ts's admin
 * deleteUserAdmin (which explicitly refuses self-deletion) -- this route
 * has no admin gate at all, but the target user id comes only from the
 * caller's own verified bearer token, never from the request body, so a
 * caller can only ever delete themselves. profiles.id -> auth.users(id)
 * is ON DELETE CASCADE (migration 0001), so the profile row and everything
 * FK-chained off it goes with the auth user.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
