# Supabase migrations: how they get applied here

## The rule

**A migration file and the row that records it must share a version.**
The version is the part of the filename before the first underscore
(`0107_plan_pick_history.sql` → `0107`). `supabase db push` decides what
to run by comparing those versions against
`supabase_migrations.schema_migrations.version` on the remote. Anything
local that isn't recorded remotely gets replayed.

## What went wrong (fixed 2026-08-16)

From `0064` onward, migrations were applied through the Supabase **MCP
tool** (`apply_migration`) rather than `supabase db push`. That tool
stamps its **own 14-digit timestamp version** and derives the name from
the argument it was given — it does not know about the local `00NN_`
filename. Meanwhile the repo kept writing sequential files.

The result: the same migration existed twice under two identities.
`0064_admin_actions_audit_log.sql` locally, `20260806155440` /
`admin_actions_audit_log` remotely. Sixty-two local files had no matching
remote version.

This was not cosmetic. `supabase db push --linked` would have replayed
all 62 — re-running DDL against objects that already exist, and
**re-inserting every seeded recipe**, silently duplicating hundreds of
rows in a table whose `name` column has no unique constraint (uniqueness
is enforced only by `scripts/recipe-content/validate-spec.ts`, which
runs before generation, not at insert time).

A second latent defect: seven files all claimed version `0092`
(`0092_seed_templates_*.sql`), so only one of them could ever be recorded.
They were renumbered `0092`, `00921`–`00926`, which sort correctly between
`0091` and `0093` because versions compare as text.

The repair marked all 62 as applied — the same thing
`supabase migration repair --status applied <version>` does — after
verifying each was genuinely live (52 matched a remote row by name; the
seven template seeds were confirmed by row counts in `program_templates`;
`0108` turned out to be the plant-forward batch, recorded remotely under
its `--label` name; `0109` and the dish-type migration were applied in
that same session).

The 63 original MCP-stamped rows were **left in place**. They are the
true record of when each change actually ran, including `created_by`.
They make `supabase migration list` show remote-only entries, which looks
noisy but is harmless: `db push` only ever acts on local-not-remote.

## Applying a migration from now on

Pick one path and stay on it:

- **`supabase db push --linked`** — preferred. Versions stay consistent
  by construction.
- **MCP `apply_migration`** — acceptable when the CLI isn't available,
  but you must then record the local file's version yourself:
  ```sql
  insert into supabase_migrations.schema_migrations (version, name)
  values ('0110', 'my_migration_name')
  on conflict (version) do nothing;
  ```
  Otherwise the divergence above starts over.

## Recipe batches specifically

`scripts/recipe-content/apply-batch.ts` inserts a validated batch's rows
directly via the service-role client, skipping names that already exist.
It's re-runnable and cannot duplicate. When you use it, the generated
migration file is a **record only** — mark its version applied (as above)
so a later push doesn't insert the same recipes a second time.
