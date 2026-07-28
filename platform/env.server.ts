import "server-only";
import { z } from "zod";
import { parseOrThrow } from "@/platform/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  // Reserved for Phase 4 — no Phase 0/1 code reads this yet.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ALLOW_SEED: z.enum(["true", "false"]).optional(),
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
      },
      "server"
    );
  }
  return cached;
}
