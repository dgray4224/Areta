import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The server-only package unconditionally throws unless resolved
      // under Next's "react-server" export condition — outside Next's
      // webpack build (i.e. in Vitest) it would break importing any file
      // that starts with `import "server-only"`. Alias it to its own
      // empty.js, the same no-op Next's server bundle already substitutes.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      // getServerEnv() requires this even when a test only cares about a
      // different field on the same schema.
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      // Fixed test-only key so token-crypto tests don't need per-test env
      // stubbing — never used outside this test run.
      CALENDAR_TOKEN_ENCRYPTION_KEY: "1/+a4zMrbCNYwijFzj5Cg6onoOUllUMrRF6Klnd8JAk=",
    },
  },
});
