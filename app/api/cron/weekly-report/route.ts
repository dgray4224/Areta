import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { sendOpsEmail } from "@/platform/alerts/email";
import { sendOpsAlert } from "@/platform/alerts/notify";
import { renderReport, findConcerns, type UsageReport } from "@/domains/observability/weekly-report";

/**
 * Monday's operator report: what the product did last week and whether
 * anyone used it.
 *
 * Monday rather than Sunday so the week it describes is finished, and
 * after the Sunday review cron so that week's briefs are counted.
 *
 * Delivery degrades rather than fails. Email is the report's natural
 * home; if it isn't configured the webhook takes it; if neither is set
 * the report still runs, logs, and comes back in the response. The point
 * is that the numbers get computed and are never silently absent.
 */

const WINDOW_DAYS = 7;

export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const until = new Date();
  const since = new Date(until.getTime() - WINDOW_DAYS * 86_400_000);

  const { data, error } = await supabase.rpc("weekly_usage_report", {
    p_since: since.toISOString(),
    p_until: until.toISOString(),
  });

  if (error || !data) {
    const detail = `Weekly report could not be computed: ${error?.message ?? "no data returned"}`;
    await sendOpsAlert({ subject: "Weekly report failed", detail });
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }

  const report = data as unknown as UsageReport;
  const { subject, body } = renderReport(report, until);
  const concerns = findConcerns(report, until);

  // Logged in full so the report survives even when every delivery
  // channel is unconfigured or down.
  console.log(`[weekly-report] ${subject}\n${body}`);

  let delivery = await sendOpsEmail({ subject, body });
  let channel = "email";
  if (!delivery.delivered) {
    delivery = await sendOpsAlert({ subject, detail: body });
    channel = "webhook";
  }

  return NextResponse.json({
    ok: true,
    subject,
    concerns: concerns.length,
    delivered: delivery.delivered,
    channel: delivery.delivered ? channel : "logs only",
    reason: delivery.reason,
    report,
  });
}
