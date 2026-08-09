-- ============================================================
-- Weekly Review Engine v2
--
-- Adds the schema support for three new capabilities in the redesigned
-- weekly-review AI engine (domains/review/*):
--
-- 1. Closed-loop experiment tracking (CLAUDE.md §8 "Recommendation
--    Feedback Loop"). Each AI-proposed change is now a stated one-week
--    hypothesis -- the model names which deterministic metric it expects
--    to move and in which direction (expected_metric/expected_direction).
--    The following week, domains/review/experiments.ts compares that
--    metric's before/after value and writes outcome_classification/
--    outcome_metric_before/outcome_metric_after/evaluated_at back onto
--    the row -- this is the only place both values are simultaneously
--    available. `followed` is a v1 proxy set equal to `accepted` at
--    approval time (approve-flow.ts) -- true partial-follow-through
--    tracking isn't built.
--
-- 2. Goal-trajectory projection. Nullable, and deliberately restricted to
--    a closed enum of metrics domains/review/metrics.ts already computes
--    deterministically -- never a free-form/custom formula, and never
--    parsed out of the existing free-text outcome/success_criteria
--    fields. A goal that never sets these simply gets no trajectory card
--    (paceStatus "not_applicable") rather than a fabricated one.
--    baseline_value/baseline_recorded_at capture the metric's value at
--    the time the target was set, so trajectory math has a starting
--    point even before enough weekly_reviews history accumulates.
-- ============================================================

alter table public.recommendations
  add column followed boolean,
  add column expected_metric text,
  add column expected_direction text check (expected_direction in ('increase', 'decrease', 'improve', 'stabilize')),
  add column outcome_classification text check (outcome_classification in ('helpful', 'neutral', 'harmful', 'unknown')),
  add column outcome_metric_before numeric,
  add column outcome_metric_after numeric,
  add column evaluated_at timestamptz;

alter table public.goals
  add column target_metric_type text check (
    target_metric_type in (
      'weight_lb', 'calorie_adherence_pct', 'protein_adherence_pct',
      'task_completion_pct', 'learning_minutes_weekly'
    )
  ),
  add column target_value numeric,
  add column target_direction text check (target_direction in ('increase', 'decrease')),
  add column baseline_value numeric,
  add column baseline_recorded_at date;

-- No RLS policy changes: the existing "goals_all_own"/"recommendations_all_own"
-- (see 0002_domains_goals_phases.sql / 0008_weekly_review.sql) policies are
-- unconditional `for all` on the owning row, so they already cover these
-- new columns.

-- weekly_reviews.answers (jsonb, default '{}') already exists from
-- 0008_weekly_review.sql and was never written to -- the new mobile
-- interview step (domains/review/service.ts's saveReviewAnswers) is its
-- first real writer. No migration needed for that.
