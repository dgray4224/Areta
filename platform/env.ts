import { z } from "zod";

/**
 * Public env vars — safe to reach the browser bundle. Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time, so these must be referenced
 * directly (not via a computed key) wherever they're read.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

function parseOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  data: unknown,
  label: string
): z.infer<Schema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid ${label} environment variables. Check .env.local against .env.local.example:\n${issues}`
    );
  }
  return result.data;
}

export const publicEnv = parseOrThrow(
  publicEnvSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  "public"
);

export { parseOrThrow };
