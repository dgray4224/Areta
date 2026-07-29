# LifeOS

Personal execution and weekly-regeneration platform. Full product spec, phase plan, and Claude Code development rules live in [`CLAUDE.md`](./CLAUDE.md) — that file is the source of truth for *what* this product is and *why*. This README covers the practical side: current build status, local setup, and how to work in this repo day to day.

- **Live:** https://getlifeos.tech (also reachable at https://lifeos-eosin-nine.vercel.app)
- **Repo:** https://github.com/dgray4224/lifeos

## Status

**Phase 0 (Foundation) + Phase 1 (Onboarding and Personal OS): done**, deployed, and verified against the real Supabase project — signup, branded email confirmation, all six onboarding steps (including skipping the optional Recovery module), review/confirm, and a personalized dashboard all work end to end, in production, with real transactional email.

**Phase 2 (Today screen and daily logging): done**, deployed, and verified in production. The dashboard is now a daily working screen: create/complete/skip tasks (with status history via `action_events`), a next-action recommendation, and quick-log entry for all five founder-relevant log types — weight, sleep, nutrition, recovery, and learning/study sessions.

**Phase 3 (Outcome-to-Operating-Parameters engine, meal planning, grocery list, Sunday prep): done**, deployed, and verified in production. A deterministic nutrition engine (Mifflin-St Jeor BMR, activity multipliers, safe rate-of-change clamping, calorie floors) turns onboarding answers into calorie/protein/macro targets with full assumption/rationale/confidence disclosure, requiring explicit user approval before anything downstream uses them (`/plan/parameters`). Approved targets drive a rule-based 7-day meal plan generator over a seeded 24-recipe library (`/plan/meals`), which cascades on approval into an aggregated, inventory-subtracted, section-grouped grocery list (`/plan/grocery`) and a Sunday prep plan following CLAUDE.md's exact 10-step ordered workflow (`/plan/prep`). The dashboard now shows today's planned meals from the active plan. No AI calls anywhere in this phase — all of it is deterministic, per the "Day 3-4" scope in the phase schedule; structured AI generation is Phase 4's weekly regeneration engine.

**Phase 4 (Weekly Review and Regeneration): done**, deployed, and verified in production with a real AI call. `/review` computes this week's deterministic metrics (weight change, calorie/protein adherence, sleep, pain/swelling trend, task completion, missed-task reasons, a data-sparsity flag) and asks 5-8 free-text questions; submitting calls a real `AIProvider` (Anthropic, via forced tool-use structured output validated against a Zod schema) to generate the qualitative half of a Weekly Operating Brief — executive summary, per-goal progress classification, top 3 priorities, proposed changes with reasons, risks, and the highest-leverage action (`/review/brief`). The AI never invents numbers or medical guidance: nutrition targets and the meal/grocery/prep plan stay on Phase 3's deterministic generators, and the system prompt explicitly forbids suggesting changes to brace settings, weight-bearing, exercise intensity, or medication. Approving the brief cascades the full regeneration cycle — nutrition parameters recalculate from the latest logged weight and auto-approve as a bundle, the meal plan regenerates folding in "meals that shouldn't return," grocery/prep cascade as in Phase 3, and `weekly_outcomes` rolls forward using the brief's priorities.

This closes out the phases in CLAUDE.md §6. See `CLAUDE.md` for the full spec if further work continues past this MVP.

**Design pass (logo + data-oriented dashboard): done**, deployed, and verified in production. A simple SVG regeneration-cycle mark (`app/icon.svg`, `platform/ui/Logo.tsx`) serves as the favicon and app/auth header branding. The dashboard's new Trends section (`app/(app)/dashboard/trends-data.ts`, `platform/ui/charts/*`) renders five real charts from actual logged data — weight (emphasis form: raw weigh-ins de-emphasized, 7-day moving average as the accent line), sleep duration, nutrition calories vs. the approved target, task completion rate, and recovery pain/swelling — built with `recharts` and colored per the dataviz skill's validated palette, mapped onto the app's existing Tailwind neutral scale rather than a separate chart-specific gray ramp.

Known gaps in what's built so far:
- The Playwright e2e spec (`tests/e2e/`) is written but requires a local Supabase stack via Docker (`supabase start`), which hasn't been available in this environment — it hasn't actually been run yet. Phases 2 and 3 were verified with unit tests plus manual browser testing instead.
- `confirmOnboarding`'s multi-table write (`domains/onboarding/write-output.ts`) is sequential inserts, not a single DB transaction — a partial failure mid-write can leave some tables written and others not. Fine for a single-user MVP; worth hardening with a Postgres function before this is multi-user.
- Password policy relies entirely on Supabase Auth's built-in minimum (8 characters) — no additional strength rule.
- Vercel deploys do **not** automatically run `supabase db push` — new migrations need to be pushed manually (see below) before/after a deploy that depends on them.
- Resend's free tier caps outgoing email at **30/hour** (raised from Supabase's default 2/hour once custom SMTP was enabled). Fine for early use; raise it from the Resend dashboard before any real launch push.
- `todayDateString()` (`app/(app)/dashboard/data.ts`) uses UTC, not the user's local timezone — the "today" a user sees around midnight local time may not match calendar-today for their timezone. Fine for a single-timezone founder MVP; worth revisiting once `profiles.timezone` is used for this.
- `inventory_items` has a table and is wired into grocery-list subtraction, but there's no UI to edit it yet — every user's inventory starts (and stays) empty until one is built, so grocery lists never actually subtract anything today.
- The recipe library (24 recipes, seeded via migration) is small and fixed — no per-user recipes, no substitutions UI, no way to exclude a recipe from future plans beyond the blunt allergy/dislike keyword match against name + ingredients.
- Meal-plan and prep-plan generation call Supabase sequentially in a few places (delete-then-insert, fetch-recipes-then-fetch-more); fine at current scale, a candidate to batch further if generation latency becomes noticeable.
- Client components that both `router.push()` to a new route and want fresh data must pick one — calling `router.refresh()` immediately after `router.push()` races the pending navigation and can strand the UI on the old route even though the underlying save succeeded (hit and fixed in `ParametersForm`/`ApprovePlanButton`; `router.push` alone already fetches fresh data for the destination).
- The Weekly Operating Brief only covers the qualitative sections (summary, progress, priorities, changes, risks, highest-leverage action). CLAUDE.md's full spec also calls for an AI-organized recovery plan, a learning plan, appointments, and a regenerated daily schedule — none of those exist yet; recovery in particular should probably stay closer to "organize clinician instructions" than a model-generated plan even when built (CLAUDE.md rule 11).
- The Recommendation Feedback Loop (CLAUDE.md §8) only goes as far as accept/reject at approval time (`recommendations.accepted`). There's no outcome/rating step in a later review, and no "use successful strategies more often" logic reading that history back — the durable-memory Layer 4 (a `memories` table with confidence/expiration/user-confirmed status) isn't built.
- `weekly_reviews`/`recommendations`/`ai_runs` have RLS but no per-user rate limiting on `generateWeeklyBrief` — a user could re-trigger AI generation repeatedly. Fine for a single founder account; worth adding before multi-user.
- Chart light-mode colors (`platform/ui/charts/colors.ts`) haven't been visually verified live — the dark-mode render was confirmed in the browser and the light values follow the same `prefers-color-scheme` pattern already proven elsewhere in the app, but worth a manual check in an actual light-mode browser/OS before calling it fully verified.

## Accounts & services this project depends on

| Service | Used for | Where |
|---|---|---|
| Supabase | Postgres, Auth, RLS | project `Life OS`, ref `eqzrvidshghwvbycdvqi` |
| Vercel | Hosting, preview/prod deploys | project `lifeos` under team `project-190` |
| Resend | Transactional email (signup confirmation, etc.) via custom SMTP | domain `getlifeos.tech`, verified |
| Vercel Domains | `getlifeos.tech` registration + DNS | DNS is auto-managed by Vercel since the domain was bought there |
| GitHub | Source control, CI | `dgray4224/lifeos` |
| Anthropic | Weekly Operating Brief generation (`claude-sonnet-5`, forced tool-use) | API key in `ANTHROPIC_API_KEY`, set both locally and in Vercel production |

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, RLS) · Zod · React Hook Form · Anthropic SDK · Recharts · Vitest · Playwright · Vercel

## Project structure

```
app/            Routes. (auth) = login/signup, (app) = authenticated shell (dashboard, onboarding, log/*, plan/*, review/*)
platform/       Platform core: auth session/actions, Supabase clients, env validation, shared UI (incl. charts/), AI provider (Anthropic + stub)
domains/        Domain modules: identity, goals, nutrition, recovery, learning, coaching, onboarding, weight, sleep,
                tasks, parameters, recipes, mealplan, grocery, prep, review
supabase/       Migrations, dev seed data, local Supabase config, custom email templates
scripts/        seed.ts — dev-only founder profile seeder
tests/          unit/ (Vitest) and e2e/ (Playwright)
```

`platform/` is reusable and domain-agnostic; `domains/` holds one folder per product domain (schema + service, sometimes more). This split is intentional (see `CLAUDE.md` §20 rule 4) so Phase 2/3 domain build-out extends existing folders instead of restructuring.

## Local setup

1. **Install tooling**: Node.js (LTS), then enable pnpm via `corepack enable` (or `npm i -g pnpm`).
2. **Install dependencies**: `pnpm install`
3. **Get Supabase credentials**: from your Supabase project → Settings → API, copy the Project URL, `anon` public key, and `service_role` key.
4. **Configure env**: copy `.env.local.example` to `.env.local` and fill in the three values above, plus `ANTHROPIC_API_KEY` (from console.anthropic.com) if you want `/review/brief` to actually generate — without it, `getAIProvider()` falls back to a stub that throws instead of silently faking a result. Leave `ALLOW_SEED=false` unless you're about to run the seed script.
5. **Link and migrate**:
   ```
   pnpm dlx supabase login --token <a personal access token from supabase.com/dashboard/account/tokens>
   pnpm dlx supabase link --project-ref <your-project-ref>
   pnpm dlx supabase db push
   ```
6. **Regenerate types** (whenever the schema changes): `pnpm dlx supabase gen types typescript --linked > platform/db/types.ts`
7. **Run it**: `pnpm dev` → http://localhost:3000

Locally, `pnpm dev` still sends through Supabase's default shared mailer unless you also configure `SUPABASE_AUTH_EXTERNAL_*`-style local SMTP — in practice, just test signup/confirmation against the deployed app (which uses Resend) rather than fighting local rate limits.

### Auth email confirmation

Email confirmation is on, and the hosted project now sends through **custom SMTP (Resend)** instead of Supabase's shared/default mailer — which was rate-limited to 2 emails/hour and explicitly not meant for production use. Setup:

- Domain `getlifeos.tech` is verified with Resend (DKIM/SPF/DMARC records added via Vercel's DNS management, since the domain was bought through Vercel Domains).
- Supabase's SMTP settings (Authentication → Emails → SMTP Settings) point at `smtp.resend.com`, sending from `noreply@getlifeos.tech`.
- The "Confirm signup" email template (Authentication → Emails → Templates) is a custom branded LifeOS template — editable now that custom SMTP is on (Supabase locks template editing behind custom SMTP on the free/default mailer).
- `signUpWithPassword` (`platform/auth/actions.ts`) passes `emailRedirectTo` pointing at `/auth/confirm`, and that route (`app/auth/confirm/route.ts`) handles both the PKCE `code` and `token_hash` confirmation formats Supabase might send, so it works regardless of template changes.
- If a confirmation click ever fails, check Vercel logs for `[auth/confirm]` — the route logs the real Supabase error. One known false alarm: email clients that prefetch/scan links (Gmail's Safe Browsing, etc.) can consume a single-use confirmation link before the user manually clicks it. Not a code bug; just click-once links being click-once.

Local dev's `enable_confirmations` is on in `supabase/config.toml`; if you run a full local Supabase stack (`supabase start`, requires Docker), confirmation emails land in the local mail-testing server at `http://127.0.0.1:54324` instead of going through Resend.

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

- **Unit** (`tests/unit/`): Zod schema validation for every onboarding and log domain, the onboarding-answers → structured-output transform (`domains/onboarding/transform.ts`), the deterministic Phase 2 logic (`computeSevenDayMovingAverage`, `computeSleepDurationMinutes`, `recommendNextAction`), the deterministic Phase 3 logic (`calculateNutritionParameters`, `generateMealPlan`, `generateGroceryList`, `generatePrepPlan`), the deterministic Phase 4 logic (`computeWeeklyMetrics`), env validation, and the `optionalNumberValue`/`optionalStringValue` form helpers (see Form patterns below). Run with `pnpm test`. The AI call itself (`AnthropicProvider`) isn't unit tested — it's a thin, mostly-untestable wrapper around a real API call; its Zod-validated output contract is what's tested indirectly by exercising `weeklyBriefSchema` and by manual end-to-end runs against the real API (see Status above).
- **E2E** (`tests/e2e/`): a Playwright smoke test covering signup → email confirmation → all onboarding steps → dashboard. Requires `supabase start` (Docker) running alongside `pnpm dev`; not yet run in this environment (see Status above). Phases 2-4's UI flows (Today screen, all five log types, the full parameters → meal plan → grocery list → prep plan chain, and a full weekly review → AI brief → approve → regenerate cycle) were verified manually via browser automation against both local dev and production instead.

## Form patterns worth knowing

React Hook Form + Zod's `.optional()` doesn't mean what you'd expect for blank form fields — this bit us twice during Phase 1 and both are now fixed with reusable helpers in `platform/ui/FormField.tsx`:

- **Optional numbers**: `valueAsNumber: true` turns an empty input into `NaN`, not `undefined`, which fails `z.number().optional()`. Use `register(name, { setValueAs: optionalNumberValue })` instead.
- **Optional selects**: a blank `<option value="">` submits `""`, which fails `z.enum([...]).optional()` (only `undefined` counts as "not answered"). Use `register(name, { setValueAs: optionalStringValue })`. This one is sneakier because the validation error can go unnoticed if the field's `error` prop isn't wired up — the form just silently refuses to submit with no visible feedback. Always pass `error={errors.<field>?.message}` to `FormField` for every registered field, including optional ones.

## Deployment

Vercel is connected to this GitHub repo (project `lifeos` under `project-190`) and auto-deploys every push to `master`, with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` set for both Production and Preview environments. GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, and a build on every push and PR.

The app is aliased to two domains: the Vercel-issued `lifeos-eosin-nine.vercel.app` and the custom `getlifeos.tech` (apex redirects to `www.getlifeos.tech`). Supabase's Auth → URL Configuration allow-list includes `http://localhost:3000/**`, both `.vercel.app` production/preview patterns, and both `getlifeos.tech` and `www.getlifeos.tech`.

If you add a new migration, remember to run `pnpm dlx supabase db push` against the linked project — Vercel does not do this automatically.

## Development rules

See `CLAUDE.md` §20 for the full list. The short version: deterministic code for calculations, AI only for interpretation/generation (not built yet), validate all AI output, no one user's data baked into platform logic (see `supabase/seed/dev-seed.ts` for how the founder's dev profile is kept isolated), require user approval before any generated plan goes live.
