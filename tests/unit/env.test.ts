import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseOrThrow } from "@/platform/env";

describe("parseOrThrow", () => {
  const schema = z.object({ FOO: z.string().min(1) });

  it("returns parsed data when valid", () => {
    expect(parseOrThrow(schema, { FOO: "bar" }, "test")).toEqual({ FOO: "bar" });
  });

  it("throws a descriptive error when invalid", () => {
    expect(() => parseOrThrow(schema, { FOO: "" }, "test")).toThrow(/Invalid test environment/);
  });
});

describe("publicEnv", () => {
  it("is parsed from NEXT_PUBLIC_* vars at module load", async () => {
    const { publicEnv } = await import("@/platform/env");
    expect(publicEnv.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
    expect(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy();
  });
});
