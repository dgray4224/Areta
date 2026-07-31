import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "@/platform/calendar/token-crypto";

describe("encryptToken / decryptToken", () => {
  it("round-trips plaintext through encrypt then decrypt", () => {
    const plaintext = "1//0gExampleRefreshToken";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("round-trips an app-specific-password-shaped string", () => {
    const plaintext = "abcd-efgh-ijkl-mnop";
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plaintext = "same-input-twice";
    expect(encryptToken(plaintext)).not.toBe(encryptToken(plaintext));
  });

  it("fails closed on tampered ciphertext rather than returning corrupt data", () => {
    const encrypted = encryptToken("sensitive-value");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedByte = Buffer.from(ciphertext, "base64");
    tamperedByte[0] = tamperedByte[0] ^ 0xff;
    const tampered = [iv, authTag, tamperedByte.toString("base64")].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("fails closed on a malformed (non-triplet) encoded string", () => {
    expect(() => decryptToken("not-a-valid-encoded-token")).toThrow(/Malformed/);
  });
});
