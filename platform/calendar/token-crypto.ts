import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getServerEnv } from "@/platform/env.server";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const { CALENDAR_TOKEN_ENCRYPTION_KEY } = getServerEnv();
  if (!CALENDAR_TOKEN_ENCRYPTION_KEY) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY is not configured.");
  }
  const key = Buffer.from(CALENDAR_TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY must decode to 32 bytes — generate one with `openssl rand -base64 32`."
    );
  }
  return key;
}

/**
 * AES-256-GCM, application-layer encryption for calendar credentials
 * (OAuth refresh/access tokens, and Apple's app-specific password) before
 * they reach Postgres — a deliberate step up from this app's usual RLS-only
 * posture, since these are standing bearer credentials to a third-party
 * account (see the plan's "Token security" rationale). Output is
 * `iv:authTag:ciphertext`, each base64, so one text column holds it.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

/** Fails closed (throws) on tampered ciphertext or a wrong key, rather than
 * ever returning corrupted plaintext — GCM's auth tag makes this detectable. */
export function decryptToken(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token.");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
