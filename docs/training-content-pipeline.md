# Training content pipeline

How to add new `training_programs` content (archetypes, programs, phases,
sessions, exercise prescriptions) over time, so the Exercise tab stays
informed by current, credible training methodology rather than going
stale. **On-demand only** — there is no scheduled/autonomous version of
this yet (see "Deferred scope" below).

## When to invoke

Trigger phrases that mean "run this procedure":
- "Add a new [archetype] program."
- "Who are the top specialists for [archetype]? Use one of them."
- "Refresh [archetype] with current trends."

If a future Claude Code session is asked something like this, follow the
procedure below rather than hand-writing SQL migrations directly — that's
exactly how the `program_session_exercises` arity bug happened the first
time this content was authored.

## The non-negotiable rule

**Every source must be a URL you (Claude) actually fetched via WebSearch
or WebFetch and can verify resolves.** Never write a citation for a
source you didn't actually visit. Never invent or guess a person's
website domain — confirm it via search first (this is exactly how
`domains/trainingprogram/source-allowlist.ts`'s existing entries were
built). If credible support can't be found for a specific prescription,
either drop that specific detail or fall back to something safer/more
generic — never fabricate specificity to make a program look more
authoritative than its sourcing actually supports.

**Content is purely additive.** This pipeline never deactivates,
modifies, or removes an existing program — older programs are not
considered stale by default, and the user has explicitly said people
often prefer established programs over newer ones. Only ever add.

## Step-by-step procedure

### a. Specialist discovery

For the target archetype, research who the recognized top specialists
are and what they specialize in. Use WebSearch broadly — general search,
plus scanning outlets like Huberman Lab's guest roster/episode topics as
one discovery source among others (see `source-allowlist.ts`'s
`discovery_source` category). Match specialty to archetype, e.g.:
- Hypertrophy / bodybuilding → Jeff Cavaliere (ATHLEAN-X)
- Broad evidence-based human performance → Andy Galpin
- General fitness / conditioning → Gunnar Peterson
- Triathlete, cyclist, olympic_weightlifter, etc. → not yet seeded;
  research a real specialist recognized specifically for that sport

Don't default to whichever specialist is already allowlisted if a
better-matched one exists for the archetype — the allowlist is meant to
grow.

### b. Domain verification

For any specialist not already in `domains/trainingprogram/source-allowlist.ts`,
confirm their real official domain via WebSearch (exactly as done when
this allowlist was first built — search "`<name>` official website",
confirm from multiple results, don't just take the first hit). Add a new
entry to `CREDIBLE_SOURCE_ALLOWLIST` with the right `category` and a
`specialty` string. This is a small, reviewable code diff — commit it
before or alongside the content batch that needs it.

### c. Draft a `ContentBatch`

Write a new `.ts` file (a reasonable convention:
`scripts/training-content/drafts/<label>.ts`, not committed if it's a
one-off) with a named export:

```ts
import type { ContentBatch } from "@/domains/trainingprogram/content-spec";

export const batch: ContentBatch = {
  newExercises: [ /* only if the program needs exercises that don't exist yet */ ],
  programs: [
    {
      archetype: "hypertrophy",
      slug: "hypertrophy-athleanx-injury-aware",
      name: "...",
      sessionsPerWeekMin: 4,
      sessionsPerWeekMax: 5,
      equipmentRequired: ["Barbell", "Dumbbells", "Full gym access"],
      phases: [ /* ... */ ],
      sources: [
        {
          organization: "Jeff Cavaliere / ATHLEAN-X",
          title: "<actual page/video title you fetched>",
          url: "https://athleanx.com/...",
          retrievedAt: "2026-08-10", // the real date you fetched it
        },
      ],
    },
  ],
};
```

See `domains/trainingprogram/content-spec.ts` for the full schema
(discriminated `strength`/`cardio` prescriptions, phase/session/exercise
structure). Reuse existing exercise names from the library where they
fit; only add `newExercises` entries for movements that genuinely don't
exist yet.

**Alternates**: any prescription (strength or cardio) can carry up to 2
`alternates` -- same-training-purpose swaps a user can pick instead of
the recommended exercise for that slot (e.g. rowing intervals also
offering swimming or biking intervals):

```ts
{
  kind: "cardio",
  exerciseRef: "Rowing intervals",
  sets: 6,
  durationMinutes: 3,
  cardioIntensity: "6 x 3 min hard, 2 min easy",
  alternates: [
    { kind: "cardio", exerciseRef: "Steady-state swim", durationMinutes: 25, cardioIntensity: "continuous, easy effort" },
    { kind: "cardio", exerciseRef: "Cycling threshold intervals", durationMinutes: 3, cardioIntensity: "6 x 3 min hard, 2 min easy" },
  ],
}
```

An alternate doesn't need to match its primary's `kind` (a strength
alternate for a cardio primary is fine), doesn't need its own `sources`
(citations live at the program level), and is validated the same way as
any prescription's `exerciseRef` -- it must resolve to an existing
exercise name or a `newExercises` refKey in the same batch. This is
purely additive and per-instance for the user (they swap for today, not
forever) -- see `domains/workoutplan/service.ts`'s
`swapWorkoutPlanItemExercise` for how the mobile app applies it.

### d. Run the pipeline

```bash
pnpm run content:add -- --spec scripts/training-content/drafts/<label>.ts
```

This runs, in order, and stops at the first failure:
1. **`validate-spec.ts`** — structural checks (slug uniqueness, phase/
   session shape, every exercise reference resolves, every program has
   at least one source).
2. **`verify-sources.ts`** — the credibility gate: every source URL must
   match the allowlist and actually resolve via a live fetch.
3. **`generate-migration.ts`** — writes a new
   `supabase/migrations/<NNNN>_content_<label>_<yyyy_mm>.sql` file.

Each step can also be run standalone with the same `--spec` flag for
debugging (e.g. `pnpm dlx tsx scripts/training-content/validate-spec.ts --spec <path>`).

### e. Review, push, verify

1. Read the generated migration file — it's plain SQL, review it like
   any other migration.
2. `pnpm dlx supabase db push --linked` (needs `SUPABASE_ACCESS_TOKEN`
   set — see the repo's existing Supabase CLI setup; if the migration
   history has drifted, see the "gotcha" note below).
3. If this batch's schema didn't change (it usually won't — this
   pipeline only adds rows), no `platform/db/types.ts` changes are
   needed. If it did, update those types by hand (this repo maintains
   that file manually, not via `supabase gen types`).
4. Spot-check with `pnpm dlx tsx scripts/verify-training-programs.ts` —
   confirms the new program is a real, selectable rotation candidate and
   materializes cleanly.
5. Update the relevant status paragraph in `README.md`.
6. Commit.

**Gotcha, seen once already**: if `supabase db push` errors about remote
migration versions not matching local files, the migration history has
drifted (e.g. content applied out-of-band via an MCP tool). Don't force
through it — reconcile with `supabase migration repair --status applied
<versions>` / `--status reverted <versions>` first, confirm with
`supabase migration list`, then push. This happened once when this
pipeline's own `0041_program_sources.sql` was first shipped; it's not
expected to recur if every migration always goes through this same
push path.

## Allowlist reference

Current entries and how to read them: `domains/trainingprogram/source-allowlist.ts`.
Institutions (`certifying_body`, `governing_body`, `peer_reviewed_journal`)
provide broad evidence-based grounding; `individual_specialist` entries
are named coaches/practitioners with real, verifiable track records;
`discovery_source` entries (currently just Huberman Lab) are useful for
finding who to research next, not for citing a program's methodology
directly.

To extend it: confirm a real domain (step b above), add one entry, done.
No other process — this is intentionally the one place a human-shaped
judgment call still exists, but as a static, reviewable config edit, not
per-piece-of-content review.

## Deferred scope

Explicitly out of scope for this pipeline as it exists today:
- No scheduled/autonomous run — someone (the user, or a future Claude
  Code session on request) has to trigger this each time.
- No AI-provider/search-grounded generation service — the "drafting"
  step is Claude Code using its own WebSearch/WebFetch tools
  interactively, not a production API integration.
- No content deactivation/retirement mechanism — this pipeline only
  ever adds.

If any of this changes later (e.g. "make this run quarterly on its
own"), that's a new design decision, not an extension of this doc.
