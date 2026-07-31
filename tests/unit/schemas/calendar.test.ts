import { describe, expect, it } from "vitest";
import { appleConnectSchema } from "@/domains/calendar/schema";

describe("appleConnectSchema", () => {
  it("accepts a valid Apple ID and app-specific-password shape", () => {
    const result = appleConnectSchema.safeParse({
      appleId: "founder@icloud.com",
      appSpecificPassword: "abcd-efgh-ijkl-mnop",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an uppercase app-specific password (case-insensitive)", () => {
    const result = appleConnectSchema.safeParse({
      appleId: "founder@icloud.com",
      appSpecificPassword: "ABCD-EFGH-IJKL-MNOP",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = appleConnectSchema.safeParse({
      appleId: "not-an-email",
      appSpecificPassword: "abcd-efgh-ijkl-mnop",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password that isn't the four-group xxxx-xxxx-xxxx-xxxx shape", () => {
    const result = appleConnectSchema.safeParse({
      appleId: "founder@icloud.com",
      appSpecificPassword: "hunter2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a real account password pasted in by mistake", () => {
    const result = appleConnectSchema.safeParse({
      appleId: "founder@icloud.com",
      appSpecificPassword: "MyRegularPassword123!",
    });
    expect(result.success).toBe(false);
  });
});
