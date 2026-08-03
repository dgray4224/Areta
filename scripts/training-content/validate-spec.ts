/**
 * Structural validation for a ContentBatch draft (see
 * docs/training-content-pipeline.md) -- checks the batch's shape (via
 * domains/trainingprogram/content-spec.ts's Zod schema) and cross-
 * references it against the live exercise/program library. This is
 * separate from scripts/training-content/verify-sources.ts's credibility
 * gate -- this script only asks "is this batch internally consistent and
 * safe to turn into SQL," not "are its citations real."
 *
 * Invoke standalone: pnpm dlx tsx scripts/training-content/validate-spec.ts --spec <path-to-batch-module>
 * The batch module must have a named export `batch: ContentBatch`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import path from "node:path";
import { pathToFileURL } from "node:url";
import { createScriptAdminClient } from "../lib/admin-client";
import { contentBatchSchema, type ContentBatch } from "@/domains/trainingprogram/content-spec";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

export type ValidationResult = { ok: boolean; errors: string[] };

/**
 * Cross-references an already Zod-valid batch against the live DB. Pure
 * validation only -- never writes anything.
 */
export async function crossReferenceBatch(
  batch: ContentBatch,
  supabase: SupabaseClient<Database>
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Slug uniqueness: within the batch, and against every program already
  // in the DB (this pipeline is purely additive -- a colliding slug is
  // always a mistake, never an intended replacement).
  const slugs = batch.programs.map((p) => p.slug);
  const duplicateSlugs = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  for (const slug of new Set(duplicateSlugs)) {
    errors.push(`Duplicate slug within this batch: "${slug}"`);
  }

  if (slugs.length > 0) {
    const { data: existing, error } = await supabase.from("training_programs").select("slug").in("slug", slugs);
    if (error) throw new Error(`Failed to check existing slugs: ${error.message}`);
    for (const row of existing ?? []) {
      errors.push(`Slug already exists in training_programs: "${row.slug}"`);
    }
  }

  // New-exercise names must not collide with the existing library
  // (case-insensitive) -- prevents near-duplicate accumulation across
  // repeated content-pipeline runs.
  if (batch.newExercises.length > 0) {
    const { data: existingExercises, error } = await supabase.from("exercises").select("name");
    if (error) throw new Error(`Failed to load existing exercises: ${error.message}`);
    const existingNamesLower = new Set((existingExercises ?? []).map((e) => e.name.toLowerCase()));
    for (const ex of batch.newExercises) {
      if (existingNamesLower.has(ex.name.toLowerCase())) {
        errors.push(`newExercises entry "${ex.name}" (refKey "${ex.refKey}") already exists in the exercise library`);
      }
    }
    const refKeys = batch.newExercises.map((e) => e.refKey);
    const duplicateRefKeys = refKeys.filter((k, i) => refKeys.indexOf(k) !== i);
    for (const key of new Set(duplicateRefKeys)) {
      errors.push(`Duplicate newExercises refKey within this batch: "${key}"`);
    }
  }

  // Build the resolvable-exercise-name set once: live library + this
  // batch's new exercises (by refKey, since that's what prescriptions
  // reference before a real DB row exists).
  const { data: allExercises, error: exercisesError } = await supabase.from("exercises").select("name");
  if (exercisesError) throw new Error(`Failed to load exercises: ${exercisesError.message}`);
  const existingNamesLower = new Set((allExercises ?? []).map((e) => e.name.toLowerCase()));
  const batchRefKeys = new Set(batch.newExercises.map((e) => e.refKey));

  for (const program of batch.programs) {
    if (program.sessionsPerWeekMin > program.sessionsPerWeekMax) {
      errors.push(
        `Program "${program.slug}": sessionsPerWeekMin (${program.sessionsPerWeekMin}) > sessionsPerWeekMax (${program.sessionsPerWeekMax})`
      );
    }

    const finalPhaseIndices = program.phases.map((p, i) => (p.isFinal ? i : -1)).filter((i) => i !== -1);
    if (finalPhaseIndices.length !== 1) {
      errors.push(`Program "${program.slug}": expected exactly one phase with isFinal=true, found ${finalPhaseIndices.length}`);
    } else if (finalPhaseIndices[0] !== program.phases.length - 1) {
      errors.push(`Program "${program.slug}": the isFinal phase must be the last phase in the array`);
    }

    if (program.sources.length === 0) {
      errors.push(`Program "${program.slug}": no sources -- every program needs at least one credible citation`);
    }

    for (const phase of program.phases) {
      for (const session of phase.sessions) {
        for (const exercise of session.exercises) {
          const ref = exercise.exerciseRef;
          const resolvable = existingNamesLower.has(ref.toLowerCase()) || batchRefKeys.has(ref);
          if (!resolvable) {
            errors.push(
              `Program "${program.slug}", phase "${phase.name}": exerciseRef "${ref}" doesn't match an existing exercise name or a newExercises refKey in this batch`
            );
          }

          const alternates = exercise.alternates ?? [];
          const alternateRefs = alternates.map((a) => a.exerciseRef);
          const duplicateAlternateRefs = alternateRefs.filter((r, i) => alternateRefs.indexOf(r) !== i);
          for (const dup of new Set(duplicateAlternateRefs)) {
            errors.push(
              `Program "${program.slug}", phase "${phase.name}": exercise "${ref}" has duplicate alternate exerciseRef "${dup}"`
            );
          }

          for (const alternate of alternates) {
            const altRef = alternate.exerciseRef;
            if (altRef === ref) {
              errors.push(
                `Program "${program.slug}", phase "${phase.name}": exercise "${ref}" has a no-op alternate (same exerciseRef as the primary)`
              );
            }
            const altResolvable = existingNamesLower.has(altRef.toLowerCase()) || batchRefKeys.has(altRef);
            if (!altResolvable) {
              errors.push(
                `Program "${program.slug}", phase "${phase.name}": alternate exerciseRef "${altRef}" (for exercise "${ref}") doesn't match an existing exercise name or a newExercises refKey in this batch`
              );
            }
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function validateContentBatch(
  rawBatch: unknown,
  supabase: SupabaseClient<Database>
): Promise<ValidationResult> {
  const parsed = contentBatchSchema.safeParse(rawBatch);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  return crossReferenceBatch(parsed.data, supabase);
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
    console.error("Usage: tsx scripts/training-content/validate-spec.ts --spec <path-to-batch-module>");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const rawBatch = await loadBatchModule(specPath);
  const result = await validateContentBatch(rawBatch, supabase);

  if (result.ok) {
    console.log("validate-spec: OK");
  } else {
    console.error(`validate-spec: ${result.errors.length} error(s):`);
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
