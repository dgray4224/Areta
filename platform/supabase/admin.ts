import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/platform/env";
import { getServerEnv } from "@/platform/env.server";
import type { Database } from "@/platform/db/types";

/**
 * Service-role client that bypasses RLS entirely — for trusted
 * server-only contexts with no user session to scope queries by (cron
 * jobs, background jobs). Never wire this into a request path driven by
 * user input without an explicit authorization check first; app/api/cron/*
 * routes gate on CRON_SECRET before ever constructing this client.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
