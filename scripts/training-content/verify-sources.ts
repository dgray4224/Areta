/**
 * The automated credibility gate (see docs/training-content-pipeline.md)
 * -- the one spot-check the user asked for. For every unique source URL
 * in a ContentBatch: (1) it must match domains/trainingprogram/
 * source-allowlist.ts, (2) a live fetch must confirm the URL actually
 * resolves. Both checks are deterministic (no model judgment involved),
 * per CLAUDE.md's rule 6/7 preference for code deciding over AI
 * inference wherever code can decide instead. Any miss is a hard
 * failure -- no partial credit.
 *
 * Invoke standalone: pnpm dlx tsx scripts/training-content/verify-sources.ts --spec <path-to-batch-module>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import path from "node:path";
import { pathToFileURL } from "node:url";
import { contentBatchSchema, type ContentBatch } from "@/domains/trainingprogram/content-spec";
import { matchAllowlist } from "@/domains/trainingprogram/source-allowlist";

const FETCH_TIMEOUT_MS = 10_000;

export type SourceCheckResult = { url: string; ok: boolean; reason?: string };
export type VerifySourcesResult = { ok: boolean; results: SourceCheckResult[] };

async function urlResolves(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Many sites reject HEAD -- fall back to GET before giving up.
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (!response.ok) {
      response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/** Verifies every unique source URL in a batch. Assumes the batch has
 * already passed Zod validation (so every source has a well-formed URL);
 * this only checks allowlist membership + live resolution. */
export async function verifySourceUrls(batch: ContentBatch): Promise<VerifySourcesResult> {
  const uniqueUrls = new Set<string>();
  for (const program of batch.programs) {
    for (const source of program.sources) uniqueUrls.add(source.url);
  }

  const results: SourceCheckResult[] = [];
  for (const url of uniqueUrls) {
    const allowlisted = matchAllowlist(url);
    if (!allowlisted) {
      results.push({ url, ok: false, reason: "not on the credible-source allowlist" });
      continue;
    }
    const resolves = await urlResolves(url);
    results.push(resolves ? { url, ok: true } : { url, ok: false, reason: "URL did not resolve (dead link or unreachable)" });
  }

  return { ok: results.every((r) => r.ok), results };
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
    console.error("Usage: tsx scripts/training-content/verify-sources.ts --spec <path-to-batch-module>");
    process.exit(1);
  }

  const rawBatch = await loadBatchModule(specPath);
  const parsed = contentBatchSchema.parse(rawBatch);
  const { ok, results } = await verifySourceUrls(parsed);

  for (const r of results) {
    console.log(`${r.ok ? "OK  " : "FAIL"} ${r.url}${r.reason ? ` -- ${r.reason}` : ""}`);
  }

  if (!ok) {
    console.error("verify-sources: one or more sources failed the credibility gate.");
    process.exit(1);
  }
  console.log("verify-sources: OK");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
