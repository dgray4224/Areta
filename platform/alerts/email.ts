import "server-only";
import { getServerEnv } from "@/platform/env.server";

/**
 * Sends the operator an email, via Resend's REST API rather than an SDK —
 * one POST, no dependency to keep updated.
 *
 * Email rather than a chat webhook for the weekly report specifically:
 * a report is read once, sitting down, and is worth keeping so this week
 * can be compared with last. A webhook message is the right shape for
 * "something broke, look now" and the wrong shape for a page of numbers
 * that scrolls away. Alerts go to platform/alerts/notify.ts; reports come
 * here.
 *
 * Same contract as the webhook alert: never throws, always logs, degrades
 * to "not configured" rather than failing the caller.
 */

const TIMEOUT_MS = 8_000;
/** Resend's shared sender. Works with no DNS setup, but only delivers to
 * the address that owns the Resend account — which is exactly the case
 * here, since the only recipient is the operator. Set OPS_EMAIL_FROM to a
 * verified domain address to lift that. */
const DEFAULT_FROM = "Areta <onboarding@resend.dev>";

export type EmailResult = { delivered: boolean; reason?: string };

export async function sendOpsEmail(input: { subject: string; body: string }): Promise<EmailResult> {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return { delivered: false, reason: "server env unavailable" };
  }

  const apiKey = env.RESEND_API_KEY;
  const to = env.OPS_EMAIL_TO;
  if (!apiKey || !to) {
    return { delivered: false, reason: !apiKey ? "RESEND_API_KEY not set" : "OPS_EMAIL_TO not set" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.OPS_EMAIL_FROM ?? DEFAULT_FROM,
        to: [to],
        subject: input.subject,
        text: input.body,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      console.error(`[ops-email] rejected: ${response.status} ${detail}`);
      return { delivered: false, reason: `Resend returned ${response.status}` };
    }
    return { delivered: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error(`[ops-email] failed: ${reason}`);
    return { delivered: false, reason };
  }
}
