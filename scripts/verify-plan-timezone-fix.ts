/**
 * E2E verification for the 2026-08-09 timezone fix
 * (domains/activity-summary/service.ts#todayForUser and its call sites in
 * app/api/plan/route.ts, mealplan/workoutplan/grocery/prep service.ts,
 * platform/scheduling/log-schedule-event.ts): a live Simulator screenshot
 * can't actually distinguish the fix from the old UTC-slice bug whenever
 * local and UTC currently agree on the calendar day (they do for most
 * negative-offset zones during daytime hours) -- so this instead seeds a
 * throwaway fixture user with profiles.time_zone forced to a zone that's
 * GUARANTEED to disagree with UTC's calendar day right now (Pacific/
 * Kiritimati, UTC+14, no DST -- already "tomorrow" there whenever UTC's
 * time-of-day is past 10:00), and asserts the real exported
 * todayForUser() returns that zone's actual local date, not the naive
 * `new Date().toISOString().slice(0, 10)` UTC date the old code used.
 * Cleans up the fixture user afterwards.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-plan-timezone-fix.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { resolveTimezone, todayForUser } from "@/domains/activity-summary/service";

const supabase = createScriptAdminClient();
const FIXTURE_EMAIL = "verify-tz-fixture@areta.local";
const FIXTURE_TIMEZONE = "Pacific/Kiritimati"; // UTC+14, no DST

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function expectedLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function createFixture(): Promise<string> {
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const leftover = userList?.users.find((u) => u.email === FIXTURE_EMAIL);
  if (leftover) await supabase.auth.admin.deleteUser(leftover.id);

  const { data, error } = await supabase.auth.admin.createUser({ email: FIXTURE_EMAIL, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const userId = data.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, time_zone: FIXTURE_TIMEZONE });
  if (profileError) throw new Error(`profiles upsert: ${profileError.message}`);

  return userId;
}

async function main() {
  const utcNow = new Date();
  const utcToday = utcNow.toISOString().slice(0, 10); // the old, buggy computation
  const expected = expectedLocalDate(FIXTURE_TIMEZONE);

  console.log(`UTC instant right now:        ${utcNow.toISOString()}`);
  console.log(`Old buggy UTC-slice "today":  ${utcToday}`);
  console.log(`Actual ${FIXTURE_TIMEZONE} local date: ${expected}`);

  assert(
    expected !== utcToday,
    `Test picked a bad moment to run -- ${FIXTURE_TIMEZONE} currently agrees with UTC on the calendar ` +
      `day (${expected}), so this run can't distinguish correct from buggy behavior. Re-run, or swap in a ` +
      `different offset for the current UTC time-of-day.`
  );

  const userId = await createFixture();
  console.log(`Fixture user created: ${userId}`);

  try {
    const resolvedTz = await resolveTimezone(supabase, userId);
    assert(resolvedTz === FIXTURE_TIMEZONE, `resolveTimezone returned "${resolvedTz}", expected "${FIXTURE_TIMEZONE}"`);
    console.log(`PASS: resolveTimezone correctly read profiles.time_zone (${resolvedTz})`);

    const today = await todayForUser(supabase, userId);
    assert(today === expected, `todayForUser returned "${today}", expected "${expected}" (the real ${FIXTURE_TIMEZONE} local date)`);
    assert(today !== utcToday, `todayForUser returned "${today}", same as the old buggy UTC-slice value -- fix isn't taking effect`);
    console.log(`PASS: todayForUser returned "${today}" -- matches real local date, diverges from the old UTC-slice bug ("${utcToday}")`);

    console.log("\nAll assertions passed -- the timezone fix is verified against a real profiles.time_zone row, not just current-moment observation.");
  } finally {
    await supabase.auth.admin.deleteUser(userId);
    console.log(`Cleaned up fixture user ${userId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
