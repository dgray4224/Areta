import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/platform/env.server";
import { createAdminClient } from "@/platform/supabase/admin";
import { localDateString } from "@/domains/activity-summary/timezone";
import { describeMonthDelta, formatMonthValue, recapMetrics, shiftMonth } from "@/domains/review/month-pacing";
import { getMonthPacing } from "@/domains/review/month-pacing-service";
import { sendPushToUsers } from "@/platform/push/send";

/**
 * Monthly cron (see vercel.json — the 1st, mid-morning US): "Your August
 * is ready." One push per onboarded user whose previous local month has
 * at least one usable metric, leading with the most common one. The push
 * lands on the You tab, where the month card and its share button live.
 *
 * Nothing is stored — the recap is recomputed from summaries on read, so
 * a re-run just re-sends; the schedule (once a month) is the throttle.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, time_zone")
    .not("onboarding_completed_at", "is", null);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (profiles ?? []).map(async (profile) => {
      const timezone = profile.time_zone ?? "UTC";
      const lastMonth = shiftMonth(localDateString(new Date(), timezone).slice(0, 7), -1);
      const pacing = await getMonthPacing(profile.id, supabase, lastMonth);
      const lead = recapMetrics(pacing)[0];
      if (!lead) return null;
      const delta = describeMonthDelta(lead);
      return {
        userId: profile.id,
        title: `Your ${pacing.monthLabel.split(" ")[0]} is ready`,
        body: `${formatMonthValue(lead, lead.toDate)}${delta ? ` — ${delta}` : ""}.`,
        screen: "review" as const,
      };
    })
  );

  const recipients = results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  const failures = results.flatMap((r, i) => (r.status === "rejected" ? [{ userId: profiles?.[i]?.id, error: String(r.reason) }] : []));

  if (recipients.length > 0) {
    await sendPushToUsers(recipients, supabase);
  }

  return NextResponse.json({ users: profiles?.length ?? 0, pushed: recipients.length, failures });
}
