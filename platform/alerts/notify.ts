import "server-only";
import { getServerEnv } from "@/platform/env.server";

/**
 * Tells the operator something broke. One webhook, no provider SDK.
 *
 * `ALERT_WEBHOOK_URL` takes a Slack or Discord incoming webhook. The body
 * carries both `text` (Slack) and `content` (Discord) so either accepts it
 * without the caller caring which is configured.
 *
 * Never throws and never blocks the caller's own result: an alert failing
 * to send must not turn a partially-successful cron into a failed one.
 * Every alert is also written to the log regardless of delivery, so the
 * Vercel logs remain a complete record even with no webhook configured.
 */

const TIMEOUT_MS = 5_000;

export type AlertResult = { delivered: boolean; reason?: string };

export async function sendOpsAlert(input: { subject: string; detail: string }): Promise<AlertResult> {
  const message = `🔴 Areta: ${input.subject}\n${input.detail}`;

  // Always logged, even when delivered, so the logs stand alone as the
  // record of what fired and when.
  console.error(`[ops-alert] ${input.subject} — ${input.detail}`);

  let url: string | undefined;
  try {
    url = getServerEnv().ALERT_WEBHOOK_URL;
  } catch {
    return { delivered: false, reason: "server env unavailable" };
  }
  if (!url) return { delivered: false, reason: "ALERT_WEBHOOK_URL not set" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message, content: message }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, 200);
      console.error(`[ops-alert] webhook rejected: ${response.status} ${body}`);
      return { delivered: false, reason: `webhook returned ${response.status}` };
    }
    return { delivered: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error(`[ops-alert] webhook failed: ${reason}`);
    return { delivered: false, reason };
  }
}
