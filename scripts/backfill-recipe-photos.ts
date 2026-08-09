/**
 * AI-generates one photo per recipe (OpenAI's gpt-image-1) and uploads it
 * to the `recipe-photos` Supabase Storage bucket (migration
 * 0105_recipe_photos_storage_bucket.sql), then writes the public Storage
 * URL back onto that recipe's `photo_url`. See docs comment on the
 * migration for why this bucket has no client-side upload path -- writes
 * happen only from here, via the service-role client, which bypasses
 * Storage RLS the same way it bypasses table RLS.
 *
 * Same shape as backfill-activity-daily-summaries.ts: a plain script using
 * createScriptAdminClient(), not the recipe-content pipeline's
 * validate -> generate-migration flow -- this operates on already-existing
 * rows via direct UPDATEs, and the process itself (external API calls,
 * partial failures, retries) doesn't fit the "reviewable SQL diff" model
 * migrations are for.
 *
 * Idempotent by default: only processes recipes where photo_url is still
 * null, so it's safe to re-run after a partial failure or to pick up
 * newly-added recipes. Requires OPENAI_API_KEY in .env.local -- this
 * script cannot run without it, and the account/billing setup that key
 * requires isn't something an agent can do on your behalf.
 *
 * Invoke: pnpm run backfill:recipe-photos -- [--cuisine <name>] [--limit N]
 *         [--quality low|medium|high] [--force]
 * Test on a slice first: pnpm run backfill:recipe-photos -- --cuisine italian --limit 5
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";

const BUCKET = "recipe-photos";
const IMAGE_SIZE = "1024x1024";
const DELAY_BETWEEN_CALLS_MS = 500;

// Rough per-image cost by quality tier, 1024x1024 -- printed up front so a
// run's total cost is visible before it starts, not discovered after the
// fact. Approximate; OpenAI's actual billing is the source of truth.
const APPROX_COST_USD: Record<string, number> = { low: 0.02, medium: 0.07, high: 0.19 };

type Quality = "low" | "medium" | "high";

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const quality = (get("--quality") ?? "medium") as Quality;
  if (!["low", "medium", "high"].includes(quality)) {
    throw new Error(`--quality must be low, medium, or high (got "${quality}")`);
  }
  return {
    cuisine: get("--cuisine"),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    force: argv.includes("--force"),
    quality,
  };
}

function buildPrompt(name: string, cuisine: string): string {
  // One consistent style template for every recipe so the library reads as
  // a cohesive set rather than a mismatched grab-bag of styles. Revised
  // after the first test batch came back too plain/stock-photo-like (flat
  // overhead shot, bare neutral plate) -- this version asks for the kind
  // of editorial styling a restaurant menu or food magazine actually uses:
  // a textured surface, a few tasteful props, and directional light with
  // real shadow, not flat studio lighting.
  return (
    `Professional restaurant-menu food photography of ${name}, ${cuisine} cuisine. ` +
    `Artfully plated and styled the way a high-end restaurant or food ` +
    `magazine would shoot it: a textured surface suited to the cuisine ` +
    `(e.g. dark wood, slate, or stone), a few tasteful styling props ` +
    `(linen, fresh herbs, a scattered ingredient or two, maybe a single ` +
    `piece of cutlery placed elegantly beside the dish), warm moody ` +
    `directional lighting with soft natural shadows, shallow depth of ` +
    `field. Shot from a natural three-quarter dining angle, not a flat ` +
    `top-down flat-lay. High detail, appetizing, editorial quality. No ` +
    `text, no watermark, no hands, no visible brand logos.`
  );
}

async function generateImageBase64(prompt: string, quality: Quality, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: IMAGE_SIZE,
      quality,
      n: 1,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI image generation failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as { data: { b64_json: string }[] };
  const b64 = data.data[0]?.b64_json;
  if (!b64) throw new Error("OpenAI response had no b64_json image data");
  return b64;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { cuisine, limit, force, quality } = parseArgs(process.argv.slice(2));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set in .env.local. This script generates photos via OpenAI's image API and " +
        "can't run without an API key -- add one from your OpenAI account (platform.openai.com) before retrying."
    );
  }

  const supabase = createScriptAdminClient();

  let query = supabase.from("recipes").select("id, name, cuisine, photo_url").order("cuisine").order("name");
  if (!force) query = query.is("photo_url", null);
  if (cuisine) query = query.eq("cuisine", cuisine);
  const { data: recipes, error } = await query;
  if (error) throw new Error(`Failed to load recipes: ${error.message}`);

  const targets = limit ? (recipes ?? []).slice(0, limit) : (recipes ?? []);
  if (targets.length === 0) {
    console.log("[backfill-recipe-photos] nothing to do -- no matching recipes without a photo_url.");
    return;
  }

  const approxCost = targets.length * (APPROX_COST_USD[quality] ?? APPROX_COST_USD.medium);
  console.log(
    `[backfill-recipe-photos] generating ${targets.length} photo(s) at "${quality}" quality ` +
      `(~$${approxCost.toFixed(2)} total, approximate)`
  );

  const failures: { name: string; error: string }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const recipe = targets[i];
    const label = `[${i + 1}/${targets.length}] ${recipe.name} (${recipe.cuisine})`;
    try {
      const prompt = buildPrompt(recipe.name, recipe.cuisine ?? "");
      const b64 = await generateImageBase64(prompt, quality, apiKey);
      const bytes = Buffer.from(b64, "base64");

      const path = `${recipe.id}.png`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("recipes")
        .update({ photo_url: publicUrlData.publicUrl })
        .eq("id", recipe.id);
      if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

      console.log(`${label}: OK -> ${publicUrlData.publicUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${label}: FAILED -- ${message}`);
      failures.push({ name: recipe.name, error: message });
    }

    if (i < targets.length - 1) await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  console.log(`[backfill-recipe-photos] done: ${targets.length - failures.length}/${targets.length} succeeded`);
  if (failures.length > 0) {
    console.log("[backfill-recipe-photos] failed (still photo_url: null, safe to re-run to retry):");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-recipe-photos] failed", err);
    process.exit(1);
  });
