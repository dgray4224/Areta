/**
 * E2E verification for Phase 3 of the enhancement roadmap (2026-08-13):
 * a manual correction (upsertManualHealthMetricOverride) must actually
 * block a subsequent HealthKit re-sync for that day
 * (insertImportedHealthMetric's new day-level override guard) — the
 * README's originally-flagged "manual correction can be silently
 * overwritten by re-import" gap. A Simulator screenshot can't verify
 * this end-to-end (it would need a second real HealthKit sync to even
 * attempt the overwrite), so this seeds a throwaway fixture user and
 * drives both functions directly against the real database.
 *
 * Invoke: pnpm dlx tsx --tsconfig tsconfig.scripts.json scripts/verify-health-metric-override.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { insertImportedHealthMetric, upsertManualHealthMetricOverride } from "@/platform/health/metrics";

const supabase = createScriptAdminClient();
const FIXTURE_EMAIL = "verify-health-override-fixture@areta.local";
const DAY = "2026-08-01";
const STARTED_AT = `${DAY}T08:00:00Z`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function createFixture(): Promise<string> {
  const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const leftover = userList?.users.find((u) => u.email === FIXTURE_EMAIL);
  if (leftover) await supabase.auth.admin.deleteUser(leftover.id);

  const { data, error } = await supabase.auth.admin.createUser({ email: FIXTURE_EMAIL, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const userId = data.user.id;

  const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, time_zone: "UTC" });
  if (profileError) throw new Error(`profiles upsert: ${profileError.message}`);

  return userId;
}

async function main() {
  const userId = await createFixture();
  console.log(`Fixture user created: ${userId}`);

  try {
    // 1. A HealthKit sample imports for this day — the ordinary path,
    // before any correction exists.
    const firstImport = await insertImportedHealthMetric(supabase, userId, "weight", {
      startedAt: STARTED_AT,
      value: 150,
      unit: "lb",
      source: "healthkit",
      dedupKey: "hk-sample-original",
    });
    assert(firstImport.ok && !firstImport.data.skipped, "First import should succeed, not be skipped");
    console.log("PASS: initial HealthKit import (150 lb) inserted");

    // 2. The user corrects that day's value.
    const override = await upsertManualHealthMetricOverride(supabase, userId, "weight", { value: 145, unit: "lb", day: DAY });
    assert(override.ok, `Override upsert failed: ${!override.ok ? override.error : ""}`);
    console.log("PASS: manual correction (145 lb) saved");

    // 3. A future re-sync brings back the ORIGINAL (wrong) value under a
    // different dedup_key -- the scenario the README flagged as broken.
    const resync = await insertImportedHealthMetric(supabase, userId, "weight", {
      startedAt: STARTED_AT,
      value: 150,
      unit: "lb",
      source: "healthkit",
      dedupKey: "hk-sample-resync",
    });
    assert(resync.ok, `Re-sync call itself failed: ${!resync.ok ? resync.error : ""}`);
    assert(resync.data.skipped, "Re-sync should be SKIPPED by the day-level override guard, but it wasn't");
    console.log("PASS: re-sync of the original value was skipped by the day-level override guard");

    // 4. The stored data reflects the correction, not the re-synced value
    // -- confirms the guard actually prevented a write, not just
    // returned skipped:true without consequence.
    const { data: rows, error: rowsError } = await supabase
      .from("health_metrics")
      .select("value, dedup_key, user_override, override_day")
      .eq("user_id", userId)
      .eq("metric_type", "weight")
      .order("dedup_key");
    if (rowsError) throw new Error(`select failed: ${rowsError.message}`);

    console.log("Rows in health_metrics for this fixture:", JSON.stringify(rows));
    assert(rows?.length === 2, `Expected exactly 2 rows (original import + override), got ${rows?.length}`);
    assert(
      !rows.some((r) => r.dedup_key === "hk-sample-resync"),
      "The re-synced row should never have been written at all"
    );
    const overrideRow = rows.find((r) => r.dedup_key === "manual-override-" + DAY);
    assert(!!overrideRow, "Override row not found by its expected dedup_key");
    assert(Number(overrideRow!.value) === 145, `Override row's value is ${overrideRow!.value}, expected 145`);
    assert(overrideRow!.user_override === true, "Override row should have user_override = true");
    assert(overrideRow!.override_day === DAY, `override_day is "${overrideRow!.override_day}", expected "${DAY}"`);
    console.log("PASS: stored data reflects the 145 lb correction; the 150 lb re-sync attempt left no trace");

    console.log("\nAll assertions passed — a manual correction genuinely survives a subsequent re-sync attempt.");
  } finally {
    await supabase.auth.admin.deleteUser(userId);
    console.log(`Cleaned up fixture user ${userId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
