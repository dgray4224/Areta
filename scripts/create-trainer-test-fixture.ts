/**
 * One-off, disposable setup for manually testing the mobile Plan tab's
 * "Program/Phase overview" trainer-coached branch (app/api/plan/program/
 * route.ts) end-to-end in the Simulator -- that branch has no automated
 * test account to exercise it against as of this writing.
 *
 * Creates: a real auth user (email/password, email pre-confirmed) with a
 * completed profile, a 2-phase trainer_programs row authored by the
 * existing trainer test account (Training Prod Tester,
 * dr.garcia444@gmail.com), an active trainer_program_assignments row
 * linking them, and a workout_plans row for the current Sun-Sat week
 * with trainer_program_id/trainer_program_phase_id populated -- exactly
 * the shape /api/plan/program's trainer-coached branch reads. Doesn't
 * call the real materialize.ts (that file transitively imports
 * platform/supabase/server, which throws outside Next's bundler -- same
 * constraint scripts/verify-training-programs.ts's own comment
 * documents), so workout_plan_items are NOT populated -- fine here,
 * since the Program/Phase overview route never reads plan items.
 *
 * Clearly a test fixture, not a real user -- @areta.local email, matches
 * this project's existing fixture convention (popup-demo@areta.local).
 * Not deleted at the end (unlike verify-*.ts's throwaway users) -- kept
 * around as a reusable trainer-coached test account, same as
 * popup-demo@areta.local is kept for onboarding-popup testing.
 *
 * Invoke with: npx tsx scripts/create-trainer-test-fixture.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";

const TRAINER_ID = "e9a680d7-2656-429e-be96-4ac7f76bf17f"; // dr.garcia444@gmail.com, existing trainer
const CLIENT_EMAIL = "trainer-coached-test-client@areta.local";
const CLIENT_PASSWORD = "trainer-coached-2026";

function sundayOfCurrentWeek(): string {
  const now = new Date();
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const supabase = createScriptAdminClient();

  console.log(`Creating trainer-coached test client: ${CLIENT_EMAIL}`);
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`Failed to create auth user: ${createError?.message}`);
  }
  const clientId = created.user.id;
  console.log(`  user id: ${clientId}`);

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: clientId,
    full_name: "Trainer-Coached Test Client",
    onboarding_completed_at: new Date().toISOString(),
  });
  if (profileError) throw new Error(`Failed to write profile: ${profileError.message}`);

  console.log("Creating 2-phase trainer program...");
  const { data: program, error: programError } = await supabase
    .from("trainer_programs")
    .insert({ trainer_id: TRAINER_ID, name: "TEST FIXTURE — Mobile Program Overview", description: "Disposable test fixture, see scripts/create-trainer-test-fixture.ts", status: "published" })
    .select("id")
    .single();
  if (programError || !program) throw new Error(`Failed to create trainer program: ${programError?.message}`);
  console.log(`  program id: ${program.id}`);

  const { data: phase1, error: phase1Error } = await supabase
    .from("trainer_program_phases")
    .insert({ program_id: program.id, phase_order: 1, name: "Foundation", focus: "Build a consistent training habit and clean technique.", length_weeks: 4, is_final: false })
    .select("id, focus")
    .single();
  if (phase1Error || !phase1) throw new Error(`Failed to create phase 1: ${phase1Error?.message}`);

  const { data: phase2, error: phase2Error } = await supabase
    .from("trainer_program_phases")
    .insert({ program_id: program.id, phase_order: 2, name: "Progressive Overload", focus: "Increase load week over week now that technique is solid.", length_weeks: 6, is_final: true })
    .select("id")
    .single();
  if (phase2Error || !phase2) throw new Error(`Failed to create phase 2: ${phase2Error?.message}`);
  console.log(`  phase 1: ${phase1.id} (4 weeks), phase 2: ${phase2.id} (6 weeks)`);

  // Assignment starts 10 days ago -- 1 week + 3 days into phase 1 (4
  // weeks long), so "week in phase" reads as a real mid-phase number,
  // not just "week 1" (which wouldn't distinguish "computed correctly"
  // from "always defaults to 1").
  const startsOn = daysAgo(10);
  console.log(`Assigning client to program (starts_on=${startsOn})...`);
  const { error: assignError } = await supabase.from("trainer_program_assignments").insert({
    trainer_id: TRAINER_ID,
    client_id: clientId,
    program_id: program.id,
    status: "active",
    starts_on: startsOn,
    end_date: null,
  });
  if (assignError) throw new Error(`Failed to create assignment: ${assignError.message}`);

  const weekStart = sundayOfCurrentWeek();
  console.log(`Writing workout_plans row for week_start=${weekStart}...`);
  const { error: planError } = await supabase.from("workout_plans").upsert(
    {
      user_id: clientId,
      week_start: weekStart,
      status: "active",
      sessions_per_week: 4,
      phase_focus: phase1.focus,
      trainer_program_id: program.id,
      trainer_program_phase_id: phase1.id,
      program_id: null,
      program_phase_id: null,
      template_id: null,
      template_phase_id: null,
      phase_week_number: null,
    },
    { onConflict: "user_id,week_start" }
  );
  if (planError) throw new Error(`Failed to write workout_plans row: ${planError.message}`);

  console.log("\nDone. Sign in on the mobile Simulator with:");
  console.log(`  email:    ${CLIENT_EMAIL}`);
  console.log(`  password: ${CLIENT_PASSWORD}`);
  console.log("\nExpected on the Plan tab's Program sub-tab:");
  console.log('  Program: "TEST FIXTURE — Mobile Program Overview"');
  console.log("  Phase 1 of 2: Foundation, week 2 of 4, 4 sessions/week, Next: Progressive Overload");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
