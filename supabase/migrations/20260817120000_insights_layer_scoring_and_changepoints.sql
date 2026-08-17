-- Insights Layer (2026-08-17): the schema half of the rebuild described in
-- areta-insights-plan.md. The insights table's shape was already right --
-- ranked feed, dedupe, share/push timestamps -- so nothing here changes
-- what a row means. What it adds is (a) enough provenance to debug and
-- regression-test ranking, (b) the graduation path from feed to chart, and
-- (c) storage for changepoints, which are the one finding type that needs
-- to outlive its card because the user annotates it.

-- === 1. Provenance and score components =====================================
--
-- Scores were previously a single opaque number each detector picked for
-- itself (score: 82, Math.min(88, 45 + effectPp * 1.5), ...), so there was
-- no way to ask why one finding outranked another, and no way to notice a
-- ranking regression. The five components are stored alongside the total so
-- ranking is inspectable in SQL, not just in whatever the scorer did that
-- day.
--
-- Columns rather than more `facts` jsonb keys deliberately: these are
-- queried and ordered by (that is the whole point), and a jsonb path is the
-- wrong tool for the thing you sort the feed on.
alter table public.insights
  add column if not exists tier smallint check (tier between 0 and 3),
  add column if not exists generator_key text,
  add column if not exists generator_version integer not null default 1,
  add column if not exists score_effect_size numeric,
  add column if not exists score_sample_size numeric,
  add column if not exists score_actionability numeric,
  add column if not exists score_goal_relevance numeric,
  add column if not exists score_surprise numeric;

comment on column public.insights.tier is
  'Data tier this finding required (0 passive .. 3 pure overhead). Recorded for analysis ONLY -- ranking is deliberately tier-blind, so a strong Tier 1 finding must be able to outrank a marginal Tier 3 one.';
comment on column public.insights.generator_key is
  'Stable identifier of the generator that produced this row, independent of `type` (several generators can emit the same display type). Paired with generator_version so a scoring change can be attributed.';
comment on column public.insights.score_surprise is
  'Deviation from a naive/population baseline. The differentiating dimension: "you walk more on days you work out" must score near zero here however statistically clean it is.';

-- === 2. Graduation ==========================================================
--
-- A finding that keeps reconfirming stops being news and becomes a landmark
-- on the persistent chart. 'graduated' is terminal for feed purposes: the
-- feed filters it out, the artifact surfaces read it.
alter table public.insights
  drop constraint if exists insights_status_check;

alter table public.insights
  add constraint insights_status_check
  check (status in ('new', 'seen', 'dismissed', 'graduated'));

-- Nullable and set only on graduation, so a chart landmark can cite the
-- finding it came from. on delete set null rather than cascade: losing the
-- memory should not silently delete the evidence that produced it.
alter table public.insights
  add column if not exists memory_id uuid references public.memories (id) on delete set null,
  add column if not exists graduated_at timestamptz;

create index if not exists insights_user_graduated_idx
  on public.insights (user_id, graduated_at desc)
  where status = 'graduated';

-- === 3. Changepoints ========================================================
--
-- Structural breaks in a daily series. Stored rather than recomputed
-- because the user annotates them ("what changed in Sept 2024?") and that
-- label is the highest-value context the app can hold -- it seeds
-- `memories` and sharpens every later finding.
--
-- COPY DISCIPLINE, enforced at the point of storage: a changepoint may
-- surface a death, a diagnosis, a divorce, a layoff. `direction` is
-- deliberately 'up'/'down' -- never 'improvement'/'decline' -- so no
-- consumer can render a value judgement it did not compute.
create table if not exists public.changepoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  detected_at date not null,
  direction text not null check (direction in ('up', 'down')),
  mean_before numeric not null,
  mean_after numeric not null,
  -- Days of data on each side. A break with 6 days after it is not a
  -- changepoint, it is a weekend; consumers filter on this.
  days_before integer not null,
  days_after integer not null,
  confidence numeric not null default 0,
  -- User-supplied, always optional, never nagged for. Null forever is a
  -- perfectly good end state for a row here.
  label text,
  labeled_at timestamptz,
  memory_id uuid references public.memories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One changepoint per metric per day per user; re-running detection
  -- updates rather than duplicating.
  unique (user_id, metric, detected_at)
);

create trigger set_changepoints_updated_at
  before update on public.changepoints
  for each row execute function public.set_updated_at();

alter table public.changepoints enable row level security;

create policy "changepoints_all_own" on public.changepoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists changepoints_user_metric_detected_idx
  on public.changepoints (user_id, metric, detected_at desc);
