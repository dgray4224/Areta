-- A weekly_reviews row the user never actually reviewed: its metrics were
-- reconstructed from imported HealthKit history so that a brand-new
-- account's first brief has real weeks to compare against, rather than an
-- empty history that made years of imported data invisible to it.
--
-- Marked rather than silently mixed in: these rows carry no brief, no
-- answers and no recommendations, and nothing should ever present one as a
-- week the user read and approved.
alter table public.weekly_reviews
  add column if not exists backfilled boolean not null default false;

comment on column public.weekly_reviews.backfilled is
  'True when this row''s metrics were reconstructed from imported health history rather than accumulated live. Never has a brief or answers.';

-- Finding a user's reconstructed weeks, and checking whether backfill has
-- already run for them, are both keyed on this.
create index if not exists weekly_reviews_user_backfilled_idx
  on public.weekly_reviews (user_id, backfilled);
