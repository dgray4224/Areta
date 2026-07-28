import { describe, expect, it } from "vitest";
import { recoverySchema } from "@/domains/recovery/schema";

describe("recoverySchema", () => {
  it("accepts a skipped step with nothing else filled in", () => {
    expect(recoverySchema.safeParse({ skipped: true }).success).toBe(true);
  });

  it("rejects a non-skipped step without warning-sign acknowledgement", () => {
    expect(recoverySchema.safeParse({ skipped: false }).success).toBe(false);
  });

  it("accepts a non-skipped step once warning signs are acknowledged", () => {
    expect(
      recoverySchema.safeParse({ skipped: false, warningSignsAcknowledged: true }).success
    ).toBe(true);
  });
});
