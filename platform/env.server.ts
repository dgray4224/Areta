import "server-only";
import { z } from "zod";
import { parseOrThrow } from "@/platform/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  // Reserved for Phase 4 — no Phase 0/1 code reads this yet.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ALLOW_SEED: z.enum(["true", "false"]).optional(),
  // Calendar integration — optional so the app still boots without it configured.
  // Apple/CalDAV needs no client id/secret, only the encryption key below.
  GOOGLE_CALENDAR_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_CALENDAR_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CALENDAR_CLIENT_SECRET: z.string().min(1).optional(),
  CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
});

let cached: z.infer<typeof serverEnvSchema> | null = null;

/** Lazily parsed so importing this module doesn't require secrets to be
 * present unless something actually calls getServerEnv() — keeps build/test
 * environments that never touch the service role key from failing. */
export function getServerEnv() {
  if (!cached) {
    cached = parseOrThrow(
      serverEnvSchema,
      {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ALLOW_SEED: process.env.ALLOW_SEED,
        GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        MICROSOFT_CALENDAR_CLIENT_ID: process.env.MICROSOFT_CALENDAR_CLIENT_ID,
        MICROSOFT_CALENDAR_CLIENT_SECRET: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET,
        CALENDAR_TOKEN_ENCRYPTION_KEY: process.env.CALENDAR_TOKEN_ENCRYPTION_KEY,
      },
      "server"
    );
  }
  return cached;
}
