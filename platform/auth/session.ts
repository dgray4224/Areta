import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/platform/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Use at the top of any Server Component under `(app)`. Middleware already
 * redirects unauthenticated requests, but this is the defense-in-depth
 * check for anything rendered without going through the matcher (e.g.
 * server actions invoked directly). */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
