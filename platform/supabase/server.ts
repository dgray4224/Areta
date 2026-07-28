import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/platform/env";
import type { Database } from "@/platform/db/types";

/** Server Component / Route Handler / Server Action client. Cookie writes
 * are swallowed when called from a Server Component (Next.js forbids
 * mutating cookies there) — `middleware.ts` is what actually refreshes the
 * session cookie on every request. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — middleware handles refresh instead.
          }
        },
      },
    }
  );
}
