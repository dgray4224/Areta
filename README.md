# Areta

Personal execution and weekly-regeneration platform (formerly "LifeOS" — renamed mid-build; `CLAUDE.md` still refers to the product as LifeOS throughout since that spec file is intentionally kept unchanged as phases ship, not because the rename didn't happen). Full product spec, phase plan, and Claude Code development rules live in [`CLAUDE.md`](./CLAUDE.md) — that file is the source of truth for *what* this product is and *why*. This README covers the practical side: current build status, local setup, and how to work in this repo day to day.

- **Live:** https://areta-ai.com (also reachable at https://getlifeos.tech and https://lifeos-eosin-nine.vercel.app during the domain transition — see "Areta rebrand" status entry below)
- **Repo:** https://github.com/dgray4224/lifeos (repo itself not yet renamed on GitHub)

## Status

**Phase 0 (Foundation) + Phase 1 (Onboarding and Personal OS): done**, deployed, and verified against the real Supabase project — signup, branded email confirmation, onboarding (Identity → Goals → Nutrition → Exercise → Review for the V1 health path), review/confirm, and a personalized dashboard all work end to end, in production, with real transactional email. Onboarding was later trimmed (see the "Onboarding trim" status entry below) to cut churn risk from a long upfront interview; Sleep and Coaching are no longer onboarding steps, and Recovery/Learning stay reachable in the data model for a future re-introduction of fine-grained goal areas but aren't offered by the current single "Health" chip in the Goals step.

**Phase 2 (Today screen and daily logging): done**, deployed, and verified in production. The dashboard is now a daily working screen: create/complete/skip tasks (with status history via `action_events`), a next-action recommendation, and quick-log entry for all five founder-relevant log types — weight, sleep, nutrition, recovery, and learning/study sessions.

**Phase 3 (Outcome-to-Operating-Parameters engine, meal planning, grocery list, Sunday prep): done**, deployed, and verified in production. A deterministic nutrition engine (Mifflin-St Jeor BMR, activity multipliers, safe rate-of-change clamping, calorie floors) turns onboarding answers into calorie/protein/macro targets with full assumption/rationale/confidence disclosure, requiring explicit user approval before anything downstream uses them (`/plan/parameters`). Approved targets drive a rule-based 7-day meal plan generator over a seeded 24-recipe library (`/plan/meals`), which cascades on approval into an aggregated, inventory-subtracted, section-grouped grocery list (`/plan/grocery`) and a Sunday prep plan following CLAUDE.md's exact 10-step ordered workflow (`/plan/prep`). No AI calls anywhere in this phase — all of it is deterministic, per the "Day 3-4" scope in the phase schedule; structured AI generation is Phase 4's weekly regeneration engine.

**Phase 4 (Weekly Review and Regeneration): done**, deployed, and verified in production with a real AI call. `/review` computes this week's deterministic metrics (weight change, calorie/protein adherence, sleep, pain/swelling trend, task completion, missed-task reasons, a data-sparsity flag) and calls a real `AIProvider` (Anthropic, via forced tool-use structured output validated against a Zod schema) to generate the qualitative half of a Weekly Operating Brief — executive summary, per-goal progress classification, top 3 priorities, proposed changes with reasons, risks, a weekly motivating quote, and the highest-leverage action (`/review/brief`). The AI never invents numbers or medical guidance: nutrition targets and the meal/grocery/prep plan stay on Phase 3's deterministic generators, and the system prompt explicitly forbids suggesting changes to brace settings, weight-bearing, exercise intensity, or medication. Approving the brief cascades the full regeneration cycle — nutrition parameters recalculate from the latest logged weight and auto-approve as a bundle, the meal plan regenerates folding in never-recommend preferences, grocery/prep cascade as in Phase 3, and `weekly_outcomes` rolls forward using the brief's priorities.

This closes out the phases in CLAUDE.md §6. See `CLAUDE.md` for the full spec if further work continues past this MVP.

**Design pass (logo + data-oriented dashboard): done**, deployed, and verified in production, later superseded by the terracotta rebrand below. The dashboard's Trends section (`app/(app)/dashboard/trends-data.ts`, `platform/ui/charts/*`) renders real charts from actual logged data — weight (7-day moving average as the accent line), sleep duration, nutrition calories vs. target, task completion rate, and recovery pain/swelling — built with `recharts`. Both light and dark mode confirmed live in the browser.

**Settings (Profile / Personalization / Appearance / Account): done**, deployed, and verified in production. `/settings/profile` edits the same identity fields captured during onboarding without redoing the interview. `/settings/personalization` — Coaching preferences (tone/planning style/reminders/explanation depth/never-recommend) and Work & School context, both fully optional and editable anytime, having moved out of onboarding. `/settings/appearance` has a real System/Light/Dark theme picker — Tailwind's `dark:` variant reads a `.dark` class (`platform/theme/theme.ts`) instead of `prefers-color-scheme` directly, set by a blocking pre-hydration script (zero flash) and kept live on "System" by `ThemeSync`. `/settings/account` has a real JSON data export, a confirm-gated "Restart onboarding" action, and Sign out (moved here once the mobile top-nav dropdown was removed — see the mobile nav entry below).

**Onboarding trim + Durable Memory + Smart Contextual Prompts: done**, deployed, and verified against the real Supabase project (migration `0011` pushed). Onboarding is now Identity → Goals → Nutrition → Exercise → Review for the V1 health path (down from 7 steps) — Sleep and Coaching were removed as onboarding questions (Sleep stays a trackable/loggable domain; Coaching now lives in `/settings/personalization`, defaulted to gentle/flexible/minimal/brief until changed), and the Goals form was cut from 10 fields per goal to 4 (Goal, Target date, Related area, Priority). The weekly review's static 8-question form is gone too — CLAUDE.md §7 Layer 4 "Durable Memory" (spec'd from the start, never built until now) exists for real: a `memories` table (preference/constraint/successful_strategy/failed_strategy/stable_schedule/motivation/communication_preference, each with evidence/confidence/review-date/user-confirmed) plus a `prompt_events` table for cooldown tracking. A fixed, deterministic trigger catalog (`domains/prompts/triggers.ts` — code decides when to ask, per CLAUDE.md rule 6, never the AI) evaluates conditions like a stalled exercise goal, a goal whose target date has passed, sleep trending below a floor, or a repeated pattern of skipped required tasks in one domain; at most one fires at a time, shown as a single dismissible card on the dashboard, and an answered prompt becomes a memory. `generateWeeklyBrief` reads recent memories instead of the removed weekly-answers.

**Today/Plan screens redesigned for prospective execution: done**, deployed, and verified in production. The old Today screen led with a 30-day retrospective chart; it's now demoted to the bottom under "This month," replaced at the top by a goal-linked task list (each task shows which goal it serves), today's workout, and a "this week" quick-links strip (grocery/meal/workout/prep status) so the two most-needed answers — "what do I do today" and "where's my grocery list" — are immediate instead of buried in a 6-step wizard. `/plan` is now a Week/Month/Year-tabbed view (`Month`/`Year` honestly render "not built yet" rather than fake data); the Week tab is a real 7-day calendar grid (meals + workout per day, today's box outlined) with a week picker for browsing past weeks, plus an AI-*selected* (never AI-generated) weekly motivating quote — the model picks an id from a small curated, hand-verified quote bank (`domains/motivation/quotes.ts`) rather than freely recalling a quote, which makes a fabricated or misattributed quote structurally impossible. The old 6-step generation wizard still exists, relocated to `/plan/setup`. Also fixed during this pass: the Sunday-prep time estimate summed every recipe's cook time as if cooked in series; it now only counts the single longest cook time, since the generated steps already tell the user to cook things in parallel.

**Terracotta brand identity + mobile-first navigation: done**, deployed, and verified in production, in both light and dark mode. New design tokens (`app/globals.css` — warm cream canvas, near-black/rich-brown hero surfaces depending on theme, terracotta brand color) and shared `Card`/`Button`/icon primitives (`platform/ui/`) replace the old plain-neutral bordered-box styling on the Today and Plan screens. A bottom tab bar (`app/(app)/BottomTabBar.tsx`) now handles primary navigation on phone **and tablet** widths (up to Tailwind's `xl` breakpoint, 1280px — an iPad's portrait viewport is 768px+, wider than the more typical `sm`/640px phone-only cutoff, so the breakpoint was deliberately raised to actually cover tablets); desktop keeps a top nav. A center FAB opens a quick-log sheet linking to all five log routes.

**Forgot password flow: done**, deployed, and verified in production (a real reset email was sent and completed end-to-end during testing). Uses Supabase's built-in `resetPasswordForEmail` + `updateUser` — reuses the existing `/auth/confirm` route (already generic over PKCE code / token_hash verification) rather than needing a second callback route. New `/forgot-password` and `/reset-password` pages; `/reset-password` is deliberately excluded from the middleware's auth-route redirect list, since the temporary recovery session it depends on would otherwise get redirected away before the user can set a new password.

**Areta rebrand: in progress.** Product renamed from LifeOS to **Areta** (Greek ἀρετή/*arete* — excellence, fulfilling one's potential; tagline "Become more of who you are"). Done: new logo mark (`app/icon.svg`, `platform/ui/Logo.tsx` — terracotta rounded-square with a dark cut-out "A," the crossbar gap reading as an upward arrow) and wordmark text; new domain `areta-ai.com` live on Vercel and fully wired through Resend (email-sending domain verified) and Supabase (Site URL + Redirect URLs + SMTP sender updated); Vercel and Supabase dashboard project names updated. Not done: `CLAUDE.md` still says LifeOS throughout (by original design — see top of this file); this README's own prose now says Areta but the **GitHub repo** is still named `lifeos` and hasn't been renamed; `app/layout.tsx`'s page `<metadata>` (browser tab title) and `package.json`'s `name` field still say `lifeos`; the old `getlifeos.tech`/`www.getlifeos.tech` domains are still live (not canceled, no redirect to the new domain set up) — see Known gaps.

Known gaps in what's built so far:
- The Playwright e2e spec (`tests/e2e/`) is written but requires a local Supabase stack via Docker (`supabase start`), which hasn't been available in this environment — it hasn't actually been run yet. Everything else was verified with unit tests plus manual browser testing instead.
- `confirmOnboarding`'s multi-table write (`domains/onboarding/write-output.ts`) is sequential inserts, not a single DB transaction — a partial failure mid-write can leave some tables written and others not. Fine for a single-user MVP; worth hardening with a Postgres function before this is multi-user.
- Password policy relies entirely on Supabase Auth's built-in minimum (8 characters) — no additional strength rule.
- Vercel deploys do **not** automatically run `supabase db push` — new migrations need to be pushed manually before/after a deploy that depends on them.
- Resend's free tier caps outgoing email at **30/hour**. Fine for early use; raise it from the Resend dashboard before any real launch push.
- `todayDateString()` (`app/(app)/dashboard/data.ts`) uses UTC, not the user's local timezone — the "today" a user sees around midnight local time may not match calendar-today for their timezone.
- `inventory_items` has a table and is wired into grocery-list subtraction, but there's no UI to edit it yet — every user's inventory starts (and stays) empty, so grocery lists never actually subtract anything today.
- The recipe library (24 recipes, seeded via migration) is small and fixed — no per-user recipes, no substitutions UI.
- The Weekly Operating Brief only covers the qualitative sections (summary, progress, priorities, changes, risks, motto, highest-leverage action). CLAUDE.md's full spec also calls for an AI-organized recovery plan, a learning plan, appointments, and a regenerated daily schedule — none of those exist yet.
- The Recommendation Feedback Loop (CLAUDE.md §8) only goes as far as accept/reject at approval time (`recommendations.accepted`). The `memories` table exists and feeds brief generation, but nothing yet cross-references memories against recommendation outcomes to close the "use successful strategies more often" loop.
- `weekly_reviews`/`recommendations`/`ai_runs` have RLS but no per-user rate limiting on `generateWeeklyBrief`. Fine for a single founder account; worth adding before multi-user.
- No account deletion — Settings > Account can export data and restart onboarding, but there's no self-serve way to delete the account itself.
- **Rebrand loose ends** (see "Areta rebrand" status above): page `<title>`/metadata, `package.json` name, and the GitHub repo name still say LifeOS/lifeos; `getlifeos.tech` is still live with no redirect to `areta-ai.com` and hasn't been canceled; `CLAUDE.md` intentionally still says LifeOS throughout.

## Accounts & services this project depends on

| Service | Used for | Where |
|---|---|---|
| Supabase | Postgres, Auth, RLS | project `Areta` (renamed from `Life OS`), ref `eqzrvidshghwvbycdvqi` |
| Vercel | Hosting, preview/prod deploys | project `Areta AI` (renamed from `lifeos`) under team `project-190` |
| Resend | Transactional email (signup confirmation, etc.) via custom SMTP | domain `areta-ai.com`, verified (migrated from `getlifeos.tech`, which was removed from Resend) |
| Vercel Domains | `areta-ai.com` registration + DNS | primary production domain; `getlifeos.tech`/`www.getlifeos.tech` and the `.vercel.app` alias are still attached to the same project too |
| GitHub | Source control, CI | `dgray4224/lifeos` (repo name not yet updated) |
| Anthropic | Weekly Operating Brief generation (`claude-sonnet-5`, forced tool-use) | API key in `ANTHROPIC_API_KEY`, set both locally and in Vercel production |

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, RLS) · Zod · React Hook Form · Anthropic SDK · Recharts · Vitest · Playwright · Vercel

## Project structure

```
app/            Routes. (auth) = login/signup/forgot-password/reset-password, (app) = authenticated shell (dashboard, onboarding, log/*, plan/*, review/*, settings/*)
platform/       Platform core: auth session/actions, Supabase clients, env validation, shared UI (incl. charts/, Card/Button/icons), theme/, AI provider (Anthropic + stub)
domains/        Domain modules: identity, goals, nutrition, recovery, learning, coaching, onboarding, weight, sleep,
                exercise, tasks, parameters, recipes, mealplan, grocery, prep, review, memory, prompts, motivation, account
supabase/       Migrations, dev seed data, local Supabase config, custom email templates
scripts/        seed.ts — dev-only founder profile seeder
tests/          unit/ (Vitest) and e2e/ (Playwright)
```

`platform/` is reusable and domain-agnostic; `domains/` holds one folder per product domain (schema + service, sometimes more). This split is intentional (see `CLAUDE.md` §20 rule 4) so domain build-out extends existing folders instead of restructuring.

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

Email confirmation is on, and the hosted project sends through **custom SMTP (Resend)** instead of Supabase's shared/default mailer — which was rate-limited to 2 emails/hour and explicitly not meant for production use. Setup:

- Domain `areta-ai.com` is verified with Resend (DKIM/SPF/DMARC records added via Vercel's DNS management, since the domain was bought through Vercel Domains).
- Supabase's SMTP settings (Authentication → Emails → SMTP Settings) point at `smtp.resend.com`, sending from `noreply@areta-ai.com`.
- Both the "Confirm signup" and "Reset password" email templates (Authentication → Emails → Templates) are custom branded templates (`supabase/templates/confirmation.html`, `supabase/templates/recovery.html`) — editable now that custom SMTP is on (Supabase locks template editing behind custom SMTP on the free/default mailer). **Both must be set up in the live dashboard to match the local `supabase/config.toml` definitions** — `supabase db push`/migrations don't sync email templates, only the Supabase dashboard (or Management API) does.
- Both templates deliberately link to our own `/auth/confirm?token_hash=...&type=...` route instead of Supabase's default `{{ .ConfirmationURL }}` link. The default link is a PKCE `code` that only completes if the *same browser/cookie context* that started the flow also opens the email link — fine for signup (usually opened right where you signed up), but a real bug for password recovery: on iPhone, tapping the reset link from the Mail app commonly opens it in an in-app browser with no access to that cookie, so the code exchange silently fails and the single-use token is burned before the user ever reaches `/reset-password`. `token_hash` + `verifyOtp()` has no such requirement — it works from any device/app that opens the link. (Found via Supabase auth logs: a real user's recovery link verified successfully server-side, then got hit two more times within a minute, both failing with "One-time token not found" — the classic signature of a token consumed by one browser context that a different context then tried and failed to reuse.)
- `signUpWithPassword` (`platform/auth/actions.ts`) passes `emailRedirectTo` pointing at `/auth/confirm`, and that route (`app/auth/confirm/route.ts`) handles both the PKCE `code` and `token_hash` formats generically — the same route also handles the password-reset link's redirect (`requestPasswordReset` points it at `/auth/confirm?next=/reset-password`), so it works regardless of which flow triggered it.
- If a confirmation or reset click ever fails, check Vercel logs for `[auth/confirm]` — the route logs the real Supabase error. One remaining known false alarm on the *signup* link specifically: email clients that prefetch/scan links (Gmail's Safe Browsing, etc.) can consume that single-use link before the user manually clicks it. Not a code bug; just click-once links being click-once.

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

- **Unit** (`tests/unit/`): Zod schema validation for every onboarding and log domain, the onboarding-answers → structured-output transform (`domains/onboarding/transform.ts`), deterministic calculation logic across every phase (nutrition parameters, meal/grocery/prep-plan generation, weekly metrics, the prompt trigger catalog), env validation, and the `optionalNumberValue`/`optionalStringValue` form helpers (see Form patterns below). Run with `pnpm test`. The AI call itself (`AnthropicProvider`) isn't unit tested — it's a thin, mostly-untestable wrapper around a real API call; its Zod-validated output contract is what's tested indirectly by exercising `weeklyBriefSchema` and by manual end-to-end runs against the real API.
- **E2E** (`tests/e2e/`): a Playwright smoke test covering signup → email confirmation → onboarding → dashboard. Requires `supabase start` (Docker) running alongside `pnpm dev`; not yet run in this environment. Every other UI flow was verified manually via browser automation against both local dev and production instead.

## Form patterns worth knowing

React Hook Form + Zod's `.optional()` doesn't mean what you'd expect for blank form fields — this bit us twice during Phase 1 and both are now fixed with reusable helpers in `platform/ui/FormField.tsx`:

- **Optional numbers**: `valueAsNumber: true` turns an empty input into `NaN`, not `undefined`, which fails `z.number().optional()`. Use `register(name, { setValueAs: optionalNumberValue })` instead.
- **Optional selects**: a blank `<option value="">` submits `""`, which fails `z.enum([...]).optional()` (only `undefined` counts as "not answered"). Use `register(name, { setValueAs: optionalStringValue })`. This one is sneakier because the validation error can go unnoticed if the field's `error` prop isn't wired up — the form just silently refuses to submit with no visible feedback. Always pass `error={errors.<field>?.message}` to `FormField` for every registered field, including optional ones.

## Deployment

Vercel is connected to this GitHub repo (project `Areta AI`, formerly `lifeos`, under `project-190`) and auto-deploys every push to `master`, with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY` set for Production (the first three also for Preview). GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, and a build on every push and PR.

**Env var changes require a redeploy** — Vercel snapshots environment variables into each deployment, so adding/changing one (e.g. via `vercel env add`) only takes effect on the next deploy. Trigger one with `vercel --prod` (or just push) after any env var change.

The app is currently aliased to four domains: the primary `areta-ai.com`, the legacy `getlifeos.tech` (apex redirects to `www.getlifeos.tech`) and `www.getlifeos.tech` itself, and the Vercel-issued `lifeos-eosin-nine.vercel.app`. The legacy domains are still live and not yet redirected to `areta-ai.com` or canceled — see Known gaps. Supabase's Auth → URL Configuration Site URL is `https://areta-ai.com`, and the Redirect URLs allow-list includes `http://localhost:3000/**`, both `.vercel.app` production/preview patterns, `areta-ai.com`/`www.areta-ai.com`, and the legacy `getlifeos.tech`/`www.getlifeos.tech` (left in place so the old domain's auth flows don't break while it's still live).

If you add a new migration, remember to run `pnpm dlx supabase db push` against the linked project — Vercel does not do this automatically.

## Development rules

See `CLAUDE.md` §20 for the full list. The short version: deterministic code for calculations, AI only for interpretation/generation (Phase 4's `AnthropicProvider` and the weekly-motto quote selection are the two places this happens — see `platform/ai/` and `domains/motivation/`), validate all AI output (Zod schema, with a retry on failure — see `platform/ai/anthropic-provider.ts`), no one user's data baked into platform logic (see `supabase/seed/dev-seed.ts` for how the founder's dev profile is kept isolated), require user approval before any generated plan goes live.

**Active navigation state must change color, not just weight/border.** An active link, tab, or pill always gets brand-colored text (`text-brand`) — a bolder font weight or an underline alone reads as barely-there, especially on desktop where there's no separate tab-bar chrome to lean on for context. This was a real bug: the desktop top nav (`AppHeader.tsx`) had no active-state logic at all, and the Health-section domain pills (`Overview`/`Nutrition`/`Exercise`/`Sleep`) looked identical no matter which one was selected. Fixed by centralizing the rule in `app/(app)/nav-links.ts` — `navLinkClass`/`navTabClass`/`navPillClass` — so every nav in the app (`AppHeader`, `BottomTabBar`, `SettingsNav`, the dashboard section tabs and `DomainNav` pills, the Plan Week/Month/Year tabs) answers "am I active?" the same way instead of each inventing its own className. Any new nav added later should use one of these three helpers rather than a one-off active/inactive className.
