-- Phase 3 of the differentiation roadmap (2026-08-14): the
-- generate-insights cron may send a push notification for a high-score
-- record/streak insight. pushed_at records which insight was pushed and
-- when -- and doubles as the throttle state: a user gets at most one
-- insight push per rolling 7 days (the cron checks for any row with
-- pushed_at in the last 7 days before sending). Partial index keeps the
-- throttle lookup cheap.
alter table public.insights add column pushed_at timestamptz;

create index insights_user_pushed_at_idx
  on public.insights (user_id, pushed_at)
  where pushed_at is not null;
