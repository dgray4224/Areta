import "server-only";
import { z } from "zod";
import { parseOrThrow } from "@/platform/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  // Shared secret Vercel Cron sends as `Authorization: Bearer <value>` --
  // gates app/api/cron/* routes, which run with no user session and would
  // otherwise be reachable by anyone who finds the URL. Optional here (not
  // required like SUPABASE_SERVICE_ROLE_KEY) so unrelated callers of
  // getServerEnv() -- the calendar/AI provider modules below -- don't
  // break for environments that never configured cron; the cron route
  // itself fails closed (401) when this is unset.
  CRON_SECRET: z.string().min(1).optional(),
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

/** A `KEY=` line with nothing after the `=` sets `process.env.KEY` to `""`,
 * not `undefined` — and Zod's `.optional()` only tolerates `undefined`, so
 * a blank placeholder line (the normal shape of an unconfigured optional
 * var in .env.local/.env.local.example) fails `.min(1)` validation instead
 * of being treated as unset. Same class of gotcha as the optionalStringValue
 * helper in platform/ui/FormField.tsx, just hitting raw env vars here. */
function emptyToUndefined(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

/** Lazily parsed so importing this module doesn't require secrets to be
 * present unless something actually calls getServerEnv() — keeps build/test
 * environments that never touch the service role key from failing. */
export function getServerEnv() {
  if (!cached) {
    cached = parseOrThrow(
      serverEnvSchema,
      {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        CRON_SECRET: emptyToUndefined(process.env.CRON_SECRET),
        ANTHROPIC_API_KEY: emptyToUndefined(process.env.ANTHROPIC_API_KEY),
        ALLOW_SEED: emptyToUndefined(process.env.ALLOW_SEED),
        GOOGLE_CALENDAR_CLIENT_ID: emptyToUndefined(process.env.GOOGLE_CALENDAR_CLIENT_ID),
        GOOGLE_CALENDAR_CLIENT_SECRET: emptyToUndefined(process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
        MICROSOFT_CALENDAR_CLIENT_ID: emptyToUndefined(process.env.MICROSOFT_CALENDAR_CLIENT_ID),
        MICROSOFT_CALENDAR_CLIENT_SECRET: emptyToUndefined(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
        CALENDAR_TOKEN_ENCRYPTION_KEY: emptyToUndefined(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY),
      },
      "server"
    );
  }
  return cached;
}
