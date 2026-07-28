/**
 * Deliberately does NOT import "server-only" or anything that transitively
 * does (e.g. platform/supabase/server.ts, platform/env.server.ts) — those
 * throw unconditionally outside Next.js's bundler, and this file is loaded
 * by scripts/seed.ts via plain `tsx`, not through Next.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

export function createScriptAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to run this script."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
