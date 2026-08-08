/**
 * Goal-first template matrix generator. Expands the 7 per-goal
 * blueprints (scripts/training-content/blueprints/*) across every
 * declared (experience tier x equipment context x duration band) combo
 * and emits ONE SQL migration file per goal into supabase/migrations/
 * (0092_seed_templates_<goal>.sql ...), each made of self-contained
 * `do $$` blocks -- one per template -- so FK wiring uses local
 * variables instead of hardcoded generated IDs.
 *
 * Deterministic: same blueprints in, byte-identical SQL out. Re-run
 * after editing a blueprint, review the diff, re-apply.
 *
 * Invoke:
 *   pnpm dlx tsx scripts/training-content/generate-templates.ts            # emit SQL files
 *   pnpm dlx tsx scripts/training-content/generate-templates.ts --stats    # coverage only
 *   pnpm dlx tsx scripts/training-content/generate-templates.ts --apply    # bulk-insert to the
 *     live DB via the service-role client (scripts/lib/admin-client.ts) -- used because the
 *     generated SQL (~1.5MB) exceeds what the MCP migration tool accepts in one call; the SQL
 *     files still land in supabase/migrations/ (with per-template idempotency guards) so fresh
 *     environments get the same content by replaying migrations.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import {
  BANDS,
  BAND_LABEL,
  BAND_MINUTES_FACTOR,
  BAND_SLOT_CAP,
  CONTEXT_LABEL,
  NO_EQUIPMENT_SWAP,
  TIERS,
  TIER_LABEL,
  type Band,
  type Blueprint,
  type Context,
  type SessionSpec,
  type SlotSpec,
  type Tier,
} from "./blueprints/types";

import { blueprint as buildMuscle } from "./blueprints/build-muscle";
import { blueprint as getStronger } from "./blueprints/get-stronger";
import { blueprint as loseFat } from "./blueprints/lose-fat";
import { blueprint as improveEndurance } from "./blueprints/improve-endurance";
import { blueprint as generalFitness } from "./blueprints/improve-general-fitness";
import { blueprint as moveFeelBetter } from "./blueprints/move-and-feel-better";
import { blueprint as trainForEvent } from "./blueprints/train-for-event";

const BLUEPRINTS: Blueprint[] = [
  loseFat,
  buildMuscle,
  getStronger,
  improveEndurance,
  generalFitness,
  moveFeelBetter,
  trainForEvent,
];

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function adaptSlots(session: SessionSpec, context: Context, band: Band, blueprint: Blueprint): SlotSpec[] {
  const swap = {
    ...(context === "home_no_equipment" ? NO_EQUIPMENT_SWAP : {}),
    ...(blueprint.contextSwap?.[context] ?? {}),
  };

  let slots = session.slots.map((slot) => ({ ...slot, pattern: swap[slot.pattern] ?? slot.pattern }));

  // Aerobic minutes scale to the band; resistance sessions trim to the
  // band's slot cap by priority (1 = kept first).
  const factor = BAND_MINUTES_FACTOR[band];
  slots = slots.map((slot) =>
    slot.minutes
      ? { ...slot, minutes: [Math.max(10, Math.round(slot.minutes[0] * factor)), Math.max(12, Math.round(slot.minutes[1] * factor))] as [number, number] }
      : slot
  );

  const isAerobicSession = slots.some((s) => s.modality === "aerobic");
  if (!isAerobicSession) {
    slots = [...slots].sort((a, b) => a.priority - b.priority).slice(0, BAND_SLOT_CAP[band]);
  }

  // A pattern swap can leave two slots targeting the same pattern in a
  // small session (e.g. two pulls both becoming core_stability) -- keep
  // the first of each duplicated pattern+label pair to avoid authoring
  // a session that is literally the same slot twice in a row.
  const seen = new Set<string>();
  slots = slots.filter((slot) => {
    const key = `${slot.pattern}:${slot.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return slots;
}

type ExpandedTemplate = {
  slug: string;
  name: string;
  goal: string;
  tier: Tier;
  context: Context;
  band: Band;
  daysMin: number;
  daysMax: number;
  description: string;
  sessions: { name: string; type: string; slots: SlotSpec[] }[];
};

function expand(blueprint: Blueprint): ExpandedTemplate[] {
  const out: ExpandedTemplate[] = [];
  for (const tier of TIERS) {
    const plan = blueprint.tiers[tier];
    for (const context of blueprint.contexts) {
      for (const band of blueprint.bands) {
        const sessions = plan.sessions
          .map((session) => ({
            name: session.name,
            type: session.type,
            slots: adaptSlots(session, context, band, blueprint),
          }))
          .filter((session) => session.slots.length > 0);
        if (sessions.length === 0) continue;
        out.push({
          slug: `${blueprint.slugBase}-${tier}-${context.replace(/_/g, "-")}-${band.replace(/_/g, "")}`,
          name: `${blueprint.name} — ${TIER_LABEL[tier]} (${CONTEXT_LABEL[context]}, ${BAND_LABEL[band]})`,
          goal: blueprint.goal,
          tier,
          context,
          band,
          daysMin: plan.days[0],
          daysMax: plan.days[1],
          description: blueprint.description,
          sessions,
        });
      }
    }
  }
  return out;
}

function templateSql(t: ExpandedTemplate, blueprint: Blueprint): string {
  const lines: string[] = [];
  lines.push("do $$");
  lines.push("declare t uuid; p uuid; s uuid;");
  lines.push("begin");
  // Idempotency guard: production is seeded by this script's --apply
  // mode, so replaying these migration files (fresh envs, supabase db
  // push) must be a no-op wherever the slug already exists.
  lines.push(`  if exists (select 1 from public.program_templates where slug = ${sqlString(t.slug)}) then return; end if;`);
  lines.push(
    `  insert into public.program_templates (slug, name, goal, experience_tier, days_per_week_min, days_per_week_max, session_duration_band, equipment_context, description, is_active)`
  );
  lines.push(
    `  values (${sqlString(t.slug)}, ${sqlString(t.name)}, ${sqlString(t.goal)}, ${sqlString(t.tier)}, ${t.daysMin}, ${t.daysMax}, ${sqlString(t.band)}, ${sqlString(t.context)}, ${sqlString(t.description)}, true)`
  );
  lines.push(`  returning id into t;`);

  blueprint.phases.forEach((phase, phaseIdx) => {
    const isFinal = phaseIdx === blueprint.phases.length - 1;
    lines.push("");
    lines.push(
      `  insert into public.template_phases (template_id, phase_order, name, focus, length_weeks, intensity_style, is_final)`
    );
    lines.push(
      `  values (t, ${phaseIdx + 1}, ${sqlString(phase.name)}, ${sqlString(phase.focus)}, ${phase.lengthWeeks}, ${sqlString(phase.intensityStyle)}, ${isFinal})`
    );
    lines.push(`  returning id into p;`);

    t.sessions.forEach((session, sessionIdx) => {
      lines.push(
        `  insert into public.template_sessions (phase_id, session_index, name, session_type) values (p, ${sessionIdx + 1}, ${sqlString(session.name)}, ${sqlString(session.type)}) returning id into s;`
      );
      const slotRows = session.slots
        .map((slot, slotIdx) => {
          const cols = [
            "s",
            String(slotIdx + 1),
            sqlString(slot.label),
            sqlString(slot.pattern),
            sqlString(slot.modality),
            "false",
            slot.sets ? String(slot.sets[0]) : "null",
            slot.sets ? String(slot.sets[1]) : "null",
            slot.reps ? String(slot.reps[0]) : "null",
            slot.reps ? String(slot.reps[1]) : "null",
            slot.effort ? sqlString(slot.effort) : "null",
            slot.restSeconds ? String(slot.restSeconds) : "null",
            slot.minutes ? String(slot.minutes[0]) : "null",
            slot.minutes ? String(slot.minutes[1]) : "null",
            slot.notes ? sqlString(slot.notes) : "null",
          ];
          return `    (${cols.join(", ")})`;
        })
        .join(",\n");
      lines.push(
        `  insert into public.template_slots (session_id, slot_order, slot_label, movement_pattern, modality, is_optional, sets_min, sets_max, reps_min, reps_max, effort_target, rest_seconds, duration_minutes_min, duration_minutes_max, coaching_notes) values`
      );
      lines.push(`${slotRows};`);
    });
  });

  lines.push("end $$;");
  return lines.join("\n");
}

async function applyToDatabase(all: { blueprint: Blueprint; templates: ExpandedTemplate[] }[]) {
  const { createScriptAdminClient } = await import("../lib/admin-client");
  const supabase = createScriptAdminClient();

  const templates = all.flatMap((g) => g.templates.map((t) => ({ t, blueprint: g.blueprint })));

  const { data: existing, error: existingError } = await supabase.from("program_templates").select("slug");
  if (existingError) throw new Error(existingError.message);
  const existingSlugs = new Set((existing ?? []).map((r: { slug: string }) => r.slug));
  const fresh = templates.filter(({ t }) => !existingSlugs.has(t.slug));
  console.log(`${templates.length} templates expanded; ${existingSlugs.size} already in DB; inserting ${fresh.length}`);
  if (fresh.length === 0) return;

  const chunk = <T,>(rows: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
    return out;
  };

  // 1. templates
  const templateRows = fresh.map(({ t }) => ({
    slug: t.slug,
    name: t.name,
    goal: t.goal,
    experience_tier: t.tier,
    days_per_week_min: t.daysMin,
    days_per_week_max: t.daysMax,
    session_duration_band: t.band,
    equipment_context: t.context,
    description: t.description,
    is_active: true,
  }));
  const templateIdBySlug = new Map<string, string>();
  for (const rows of chunk(templateRows, 200)) {
    const { data, error } = await supabase.from("program_templates").insert(rows).select("id, slug");
    if (error) throw new Error(`templates: ${error.message}`);
    for (const r of data ?? []) templateIdBySlug.set(r.slug, r.id);
  }

  // 2. phases (2 per template, keyed back by (template_id, phase_order))
  const phaseRows = fresh.flatMap(({ t, blueprint }) =>
    blueprint.phases.map((phase, idx) => ({
      template_id: templateIdBySlug.get(t.slug)!,
      phase_order: idx + 1,
      name: phase.name,
      focus: phase.focus,
      length_weeks: phase.lengthWeeks,
      intensity_style: phase.intensityStyle,
      is_final: idx === blueprint.phases.length - 1,
    }))
  );
  const phaseIdByKey = new Map<string, string>();
  for (const rows of chunk(phaseRows, 400)) {
    const { data, error } = await supabase.from("template_phases").insert(rows).select("id, template_id, phase_order");
    if (error) throw new Error(`phases: ${error.message}`);
    for (const r of data ?? []) phaseIdByKey.set(`${r.template_id}:${r.phase_order}`, r.id);
  }

  // 3. sessions (same session list under both phases)
  const sessionRows = fresh.flatMap(({ t, blueprint }) =>
    blueprint.phases.flatMap((_, phaseIdx) =>
      t.sessions.map((session, sessionIdx) => ({
        phase_id: phaseIdByKey.get(`${templateIdBySlug.get(t.slug)!}:${phaseIdx + 1}`)!,
        session_index: sessionIdx + 1,
        name: session.name,
        session_type: session.type,
      }))
    )
  );
  const sessionIdByKey = new Map<string, string>();
  for (const rows of chunk(sessionRows, 500)) {
    const { data, error } = await supabase.from("template_sessions").insert(rows).select("id, phase_id, session_index");
    if (error) throw new Error(`sessions: ${error.message}`);
    for (const r of data ?? []) sessionIdByKey.set(`${r.phase_id}:${r.session_index}`, r.id);
  }

  // 4. slots
  const slotRows = fresh.flatMap(({ t, blueprint }) =>
    blueprint.phases.flatMap((_, phaseIdx) => {
      const phaseId = phaseIdByKey.get(`${templateIdBySlug.get(t.slug)!}:${phaseIdx + 1}`)!;
      return t.sessions.flatMap((session, sessionIdx) => {
        const sessionId = sessionIdByKey.get(`${phaseId}:${sessionIdx + 1}`)!;
        return session.slots.map((slot, slotIdx) => ({
          session_id: sessionId,
          slot_order: slotIdx + 1,
          slot_label: slot.label,
          movement_pattern: slot.pattern,
          modality: slot.modality,
          is_optional: false,
          sets_min: slot.sets?.[0] ?? null,
          sets_max: slot.sets?.[1] ?? null,
          reps_min: slot.reps?.[0] ?? null,
          reps_max: slot.reps?.[1] ?? null,
          effort_target: slot.effort ?? null,
          rest_seconds: slot.restSeconds ?? null,
          duration_minutes_min: slot.minutes?.[0] ?? null,
          duration_minutes_max: slot.minutes?.[1] ?? null,
          coaching_notes: slot.notes ?? null,
        }));
      });
    })
  );
  let inserted = 0;
  for (const rows of chunk(slotRows, 500)) {
    const { error } = await supabase.from("template_slots").insert(rows);
    if (error) throw new Error(`slots: ${error.message}`);
    inserted += rows.length;
  }
  console.log(`Inserted ${fresh.length} templates, ${phaseRows.length} phases, ${sessionRows.length} sessions, ${inserted} slots`);
}

async function main() {
  const statsOnly = process.argv.includes("--stats");
  const apply = process.argv.includes("--apply");
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

  let totalTemplates = 0;
  let totalSlots = 0;
  const coverage: Record<string, number> = {};
  const expandedAll: { blueprint: Blueprint; templates: ExpandedTemplate[] }[] = [];

  for (const blueprint of BLUEPRINTS) {
    const templates = expand(blueprint);
    expandedAll.push({ blueprint, templates });
    totalTemplates += templates.length;
    for (const t of templates) {
      coverage[`${t.goal}/${t.tier}`] = (coverage[`${t.goal}/${t.tier}`] ?? 0) + 1;
      totalSlots += t.sessions.reduce((n, s) => n + s.slots.length, 0) * blueprint.phases.length;
    }

    if (!statsOnly) {
      const header = `-- GENERATED by scripts/training-content/generate-templates.ts -- do not\n-- hand-edit; edit the blueprint (scripts/training-content/blueprints/\n-- ${blueprint.slugBase}.ts) and re-run the generator instead.\n--\n-- Seeds the goal-first program_templates matrix for goal='${blueprint.goal}':\n-- ${templates.length} templates (tier x context x band), 2 phases each,\n-- sessions/slots per the blueprint. Slots are ABSTRACT movement-pattern\n-- prescriptions (0089's taxonomy); concrete exercises are chosen per\n-- user per week by domains/recommendation/*.\n\n`;
      const body = templates.map((t) => templateSql(t, blueprint)).join("\n\n");
      const file = path.join(migrationsDir, `0092_seed_templates_${blueprint.goal}.sql`);
      fs.writeFileSync(file, header + body + "\n");
      console.log(`${path.basename(file)}: ${templates.length} templates, ${Math.round((header + body).length / 1024)}KB`);
    }
  }

  console.log("\nCoverage (goal/tier -> template count):");
  for (const [key, count] of Object.entries(coverage).sort()) console.log(`  ${key}: ${count}`);
  console.log(`\nTotal: ${totalTemplates} templates, ~${totalSlots} slots`);

  // Every goal x tier must have at least one template -- the matrix
  // guarantee the whole exercise depends on.
  const missing: string[] = [];
  for (const blueprint of BLUEPRINTS) {
    for (const tier of TIERS) {
      if (!coverage[`${blueprint.goal}/${tier}`]) missing.push(`${blueprint.goal}/${tier}`);
    }
  }
  if (missing.length > 0) {
    console.error(`\nMISSING COVERAGE: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (apply) {
    await applyToDatabase(expandedAll);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
