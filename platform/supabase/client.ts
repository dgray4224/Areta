import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/platform/env";
import type { Database } from "@/platform/db/types";

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
