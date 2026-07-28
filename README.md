# LifeOS

Personal execution and weekly-regeneration platform. Full product spec, phase plan, and Claude Code development rules live in [`CLAUDE.md`](./CLAUDE.md) — that file is the source of truth for *what* this product is and *why*. This README covers the practical side: current build status, local setup, and how to work in this repo day to day.

- **Live:** https://lifeos-eosin-nine.vercel.app
- **Repo:** https://github.com/dgray4224/lifeos

## Status

**Phase 0 (Foundation) + Phase 1 (Onboarding and Personal OS): done**, deployed, and verified against the real Supabase project — signup, email confirmation, all six onboarding steps (including skipping the optional Recovery module), review/confirm, and a personalized dashboard all work end to end.

Not built yet: Today screen and daily logging (Phase 2), the Outcome-to-Operating-Parameters engine and meal/grocery planning (Phase 3), weekly review and AI-generated regeneration (Phase 4). See `CLAUDE.md` §6 for the full phase breakdown.

Known gaps in what's built so far:
- The Playwright e2e spec (`tests/e2e/`) is written but requires a local Supabase stack via Docker (`supabase start`), which hasn't been available in this environment — it hasn't actually been run yet.
- `confirmOnboarding`'s multi-table write (`domains/onboarding/write-output.ts`) is sequential inserts, not a single DB transaction — a partial failure mid-write can leave some tables written and others not. Fine for a single-user MVP; worth hardening with a Postgres function before this is multi-user.
- Password policy relies entirely on Supabase Auth's built-in minimum (8 characters) — no additional strength rule.
- Vercel deploys do **not** automatically run `supabase db push` — new migrations need to be pushed manually (see below) before/after a deploy that depends on them.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, RLS) · Zod · React Hook Form · Vitest · Playwright · Vercel

## Project structure

```
app/            Routes. (auth) = login/signup, (app) = authenticated shell (dashboard, onboarding)
platform/       Platform core: auth session/actions, Supabase clients, env validation, shared UI, AI provider interface
domains/        Domain modules: identity, goals, nutrition, recovery, learning, coaching, onboarding
supabase/       Migrations, dev seed data, local Supabase config
scripts/        seed.ts — dev-only founder profile seeder
tests/          unit/ (Vitest) and e2e/ (Playwright)
```

`platform/` is reusable and domain-agnostic; `domains/` holds one folder per product domain (schema + service, sometimes more). This split is intentional (see `CLAUDE.md` §20 rule 4) so Phase 2/3 domain build-out extends existing folders instead of restructuring.

## Local setup

1. **Install tooling**: Node.js (LTS), then enable pnpm via `corepack enable` (or `npm i -g pnpm`).
2. **Install dependencies**: `pnpm install`
3. **Get Supabase credentials**: from your Supabase project → Settings → API, copy the Project URL, `anon` public key, and `service_role` key.
4. **Configure env**: copy `.env.local.example` to `.env.local` and fill in the three values above. `ANTHROPIC_API_KEY` is reserved for Phase 4 and unused right now. Leave `ALLOW_SEED=false` unless you're about to run the seed script.
5. **Link and migrate**:
   ```
   pnpm dlx supabase login --token <a personal access token from supabase.com/dashboard/account/tokens>
   pnpm dlx supabase link --project-ref <your-project-ref>
   pnpm dlx supabase db push
   ```
6. **Regenerate types** (whenever the schema changes): `pnpm dlx supabase gen types typescript --linked > platform/db/types.ts`
7. **Run it**: `pnpm dev` → http://localhost:3000

### Auth email confirmation

Email confirmation is on. The hosted Supabase project can't customize its email templates without custom SMTP configured, so instead `signUpWithPassword` (`platform/auth/actions.ts`) passes `emailRedirectTo` pointing at `/auth/confirm`, which handles Supabase's confirmation redirect (both the PKCE `code` and `token_hash` formats) and establishes the session. No email template changes are needed for this to work, locally or on Vercel.

Local dev's `enable_confirmations` is on in `supabase/config.toml`; if you ever run a full local Supabase stack (`supabase start`, requires Docker), confirmation emails land in the local mail-testing server at `http://127.0.0.1:54324`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright e2e (needs a running app + local Supabase via Docker) |
| `pnpm seed` | Seeds the dev-only founder profile (`CLAUDE.md` §17) — refuses to run unless `ALLOW_SEED=true` |

## Testing

- **Unit** (`tests/unit/`): Zod schema validation for every onboarding domain, the onboarding-answers → structured-output transform (`domains/onboarding/transform.ts`), and env validation. Run with `pnpm test`.
- **E2E** (`tests/e2e/`): a Playwright smoke test covering signup → email confirmation → all onboarding steps → dashboard. Requires `supabase start` (Docker) running alongside `pnpm dev`; not yet run in this environment (see Status above).

## Deployment

Vercel is connected to this GitHub repo (project `lifeos` under `project-190`) and auto-deploys every push to `master`, with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` set for both Production and Preview environments. GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, and a build on every push and PR.

Supabase's Auth → URL Configuration allow-list includes `http://localhost:3000/**`, the production alias `https://lifeos-eosin-nine.vercel.app/**`, and a wildcard for this project's preview deployment URLs.

If you add a new migration, remember to run `pnpm dlx supabase db push` against the linked project — Vercel does not do this automatically.

## Development rules

See `CLAUDE.md` §20 for the full list. The short version: deterministic code for calculations, AI only for interpretation/generation (not built yet), validate all AI output, no one user's data baked into platform logic (see `supabase/seed/dev-seed.ts` for how the founder's dev profile is kept isolated), require user approval before any generated plan goes live.
