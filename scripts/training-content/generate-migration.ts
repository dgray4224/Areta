/**
 * Turns a validated ContentBatch into a real SQL migration file --
 * programmatically, from typed objects, never from hand-typed tuples.
 * This is the actual fix for the arity-mismatch bug class hit while
 * hand-authoring `0032`-`0040`: every `program_session_exercises` row
 * gets its own single-row INSERT statement (rather than a batched
 * multi-row VALUES list), so a cardio-shaped row's column list can never
 * end up misaligned with a strength-shaped row's values in the same
 * statement -- the exact shape of today's bug.
 *
 * Writes a file for review + `supabase db push` (same as every other
 * migration in this repo) -- does NOT apply directly, to avoid the
 * migration-history reconciliation issues hit this session.
 *
 * Invoke standalone: pnpm dlx tsx scripts/training-content/generate-migration.ts --spec <path-to-batch-module> [--label <label>]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentBatchSchema, type ContentBatch, type PrescriptionSpec, type AlternateSpec } from "@/domains/trainingprogram/content-spec";

const MIGRATIONS_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../supabase/migrations");

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "null" : String(value);
}

function sqlBool(value: boolean): string {
  return value ? "true" : "false";
}

function sqlStringArray(values: string[]): string {
  if (values.length === 0) return "array[]::text[]";
  return `array[${values.map((v) => sqlString(v)).join(", ")}]`;
}

function nextMigrationNumber(): string {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_/.test(f));
  const max = files.reduce((acc, f) => Math.max(acc, parseInt(f.slice(0, 4), 10)), 0);
  return String(max + 1).padStart(4, "0");
}

function batchLabel(batch: ContentBatch, override?: string): string {
  if (override) return override;
  const archetypes = Array.from(new Set(batch.programs.map((p) => p.archetype))).sort();
  return archetypes.length === 1 ? archetypes[0] : archetypes.join("_");
}

function yearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function emitNewExercises(batch: ContentBatch): string {
  if (batch.newExercises.length === 0) return "";
  const rows = batch.newExercises
    .map(
      (ex) =>
        `(${sqlString(ex.name)}, ${sqlString(ex.movementPattern)}, ${sqlStringArray(ex.equipmentRequired)}, ` +
        `${sqlStringArray(ex.archetypeTags)}, ${sqlString(ex.difficulty)}, ${sqlStringArray(ex.primaryMuscleGroups)}, ` +
        `${sqlString(ex.instructions ?? null)})`
    )
    .join(",\n  ");

  return (
    `-- New exercises this batch's programs need, seeded before the\n` +
    `-- programs that reference them so the exercise_id subqueries below\n` +
    `-- resolve within the same migration.\n` +
    `insert into public.exercises\n` +
    `  (name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions) values\n  ` +
    rows +
    ";\n\n"
  );
}

/** Emits the primary row (capturing its id into v_primary_id) followed by
 * any alternates (each referencing v_primary_id via primary_exercise_id,
 * sharing the primary's exercise_order -- harmless now that the FK, not
 * exercise_order, is what actually groups them). One INSERT per row,
 * always -- never a batched multi-row VALUES list, so a strength- and
 * cardio-shaped row can never end up mismatched in the same statement. */
function emitPrescription(
  exercise: PrescriptionSpec,
  refKeyToName: Map<string, string>,
  sessionOrder: number
): string {
  const resolveNameSql = (ref: string) => {
    const resolvedName = refKeyToName.get(ref) ?? ref;
    return `select id from exercises where name = ${sqlString(resolvedName)}`;
  };

  // Returns the INSERT statement up to (and including) the closing paren
  // of the VALUES tuple, deliberately without a terminator -- the caller
  // appends either `; ` (alternates) or `returning id into v_primary_id;`
  // (the primary row), since `returning ... into` must be part of the
  // same statement, not appended after it's already been terminated.
  function emitRowBody(row: PrescriptionSpec | AlternateSpec, primaryExerciseIdSql: string): string {
    const exerciseNameSql = resolveNameSql(row.exerciseRef);
    if (row.kind === "strength") {
      return (
        `  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes, primary_exercise_id) values\n` +
        `    (v_session_id, ${sessionOrder}, (${exerciseNameSql}), ${sqlNumber(row.sets)}, ${sqlNumber(row.repsMin)}, ${sqlNumber(row.repsMax)}, ${sqlString(row.intensityType)}, ${sqlString(row.intensityValue ?? null)}, ${sqlString(row.coachingNotes ?? null)}, ${primaryExerciseIdSql})`
      );
    }
    return (
      `  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values\n` +
      `    (v_session_id, ${sessionOrder}, (${exerciseNameSql}), ${sqlNumber(row.sets ?? null)}, ${sqlNumber(row.durationMinutes)}, ${sqlString(row.cardioIntensity)}, ${sqlString(row.coachingNotes ?? null)}, ${primaryExerciseIdSql})`
    );
  }

  let sql = emitRowBody(exercise, "null") + "\n  returning id into v_primary_id;\n";

  for (const alternate of exercise.alternates ?? []) {
    sql += emitRowBody(alternate, "v_primary_id") + ";\n";
  }

  return sql;
}

function emitProgram(batch: ContentBatch, refKeyToName: Map<string, string>, programIndex: number): string {
  const program = batch.programs[programIndex];
  const lines: string[] = [];

  lines.push(`  -- Program ${programIndex + 1}: ${program.name} (${program.slug})`);
  lines.push("  insert into training_programs");
  lines.push("    (archetype, slug, name, description, methodology_note, experience_level,");
  lines.push("     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)");
  lines.push("  values");
  lines.push(
    `    (${sqlString(program.archetype)}, ${sqlString(program.slug)}, ${sqlString(program.name)}, ${sqlString(program.description ?? null)},\n` +
      `     ${sqlString(program.methodologyNote ?? null)}, ${sqlString(program.experienceLevel ?? null)}, ${sqlNumber(program.sessionsPerWeekMin)}, ${sqlNumber(program.sessionsPerWeekMax)},\n` +
      `     ${sqlStringArray(program.equipmentRequired)}, ${sqlNumber(program.displayOrder)})`
  );
  lines.push("  returning id into v_program_id;\n");

  const sourceRows = program.sources
    .map((s) => `    (v_program_id, ${sqlString(s.organization)}, ${sqlString(s.title)}, ${sqlString(s.url)}, ${sqlString(s.retrievedAt)})`)
    .join(",\n");
  lines.push("  insert into program_sources (program_id, organization, title, url, retrieved_at) values");
  lines.push(sourceRows + ";\n");

  program.phases.forEach((phase, phaseIdx) => {
    lines.push(`  -- Phase ${phaseIdx + 1}: ${phase.name}`);
    lines.push("  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)");
    lines.push(
      `  values (v_program_id, ${phaseIdx + 1}, ${sqlString(phase.name)}, ${sqlString(phase.focus ?? null)}, ${sqlNumber(phase.lengthWeeks)}, ${sqlString(phase.intensityStyle ?? null)}, ${sqlBool(phase.isFinal)})`
    );
    lines.push("  returning id into v_phase_id;\n");

    phase.sessions.forEach((session, sessionIdx) => {
      lines.push(
        `  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, ${sessionIdx + 1}, ${sqlString(session.name ?? null)}, ${sqlString(session.sessionType ?? null)}) returning id into v_session_id;`
      );
      session.exercises.forEach((exercise, exerciseIdx) => {
        lines.push(emitPrescription(exercise, refKeyToName, exerciseIdx + 1));
      });
      lines.push("");
    });
  });

  return lines.join("\n");
}

/** Pure -- builds the full migration SQL text from a validated batch. */
export function buildMigrationSql(batch: ContentBatch): string {
  const refKeyToName = new Map(batch.newExercises.map((e) => [e.refKey, e.name]));

  const header =
    `-- Generated by scripts/training-content/generate-migration.ts from a\n` +
    `-- validated ContentBatch (see docs/training-content-pipeline.md).\n` +
    `-- Purely additive: adds new programs/exercises and their source\n` +
    `-- citations, never modifies or deactivates existing rows.\n\n`;

  const newExercisesSql = emitNewExercises(batch);

  const programsSql = batch.programs
    .map((_, i) => {
      return (
        "do $$\n" +
        "declare\n" +
        "  v_program_id uuid;\n" +
        "  v_phase_id uuid;\n" +
        "  v_session_id uuid;\n" +
        "  v_primary_id uuid;\n" +
        "begin\n\n" +
        emitProgram(batch, refKeyToName, i) +
        "\nend $$;\n"
      );
    })
    .join("\n\n");

  return header + newExercisesSql + programsSql;
}

export function generateMigrationFile(batch: ContentBatch, label?: string): string {
  const number = nextMigrationNumber();
  const filename = `${number}_content_${batchLabel(batch, label)}_${yearMonth()}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, filename);
  fs.writeFileSync(filePath, buildMigrationSql(batch));
  return filePath;
}

async function loadBatchModule(specPath: string): Promise<unknown> {
  const absolute = path.resolve(process.cwd(), specPath);
  const mod = (await import(pathToFileURL(absolute).href)) as { batch?: unknown };
  if (!mod.batch) {
    throw new Error(`${specPath} must have a named export \`batch\` (a ContentBatch object).`);
  }
  return mod.batch;
}

async function main() {
  const specArgIndex = process.argv.indexOf("--spec");
  const specPath = specArgIndex !== -1 ? process.argv[specArgIndex + 1] : undefined;
  if (!specPath) {
    console.error("Usage: tsx scripts/training-content/generate-migration.ts --spec <path-to-batch-module> [--label <label>]");
    process.exit(1);
  }
  const labelArgIndex = process.argv.indexOf("--label");
  const label = labelArgIndex !== -1 ? process.argv[labelArgIndex + 1] : undefined;

  const rawBatch = await loadBatchModule(specPath);
  const batch = contentBatchSchema.parse(rawBatch);
  const filePath = generateMigrationFile(batch, label);
  console.log(`Wrote ${filePath}`);
  console.log("Review it, then run: pnpm dlx supabase db push --linked");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
