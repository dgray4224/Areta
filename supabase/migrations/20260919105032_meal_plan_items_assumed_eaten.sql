-- Silence means the plan happened.
--
-- The product promises you don't log. For movement that was already true
-- because Health supplies it; for food it was not, because every meal
-- needed a tap and almost nobody taps — across the first 13 accounts the
-- whole history was 19 meals ticked. Nutrition adherence was therefore
-- permanently blank and the weekly brief could only say it had nothing
-- to work with.
--
-- So a planned meal on a finished day is now taken to have been eaten
-- (domains/mealplan/assume-meals.ts). That is a real claim about
-- someone's diet which then drives calorie advice, so two columns keep
-- it honest:
--
--   completed_source  'assumed' is never passed off as 'manual', so the
--                     brief can weight an assumption as weaker evidence
--                     than a confirmation.
--   skipped_at        "didn't eat this" is a first-class answer. Without
--                     it, a decline and a not-yet-asked look identical
--                     and the next nightly pass would overrule the
--                     person.
alter table public.meal_plan_items
  add column if not exists completed_source text
    check (completed_source is null or completed_source in ('manual', 'assumed')),
  add column if not exists skipped_at timestamptz;

comment on column public.meal_plan_items.completed_source is
  'How the item came to be eaten: manual (the person confirmed it) or assumed (the plan was taken to have happened because nobody said otherwise). Null for anything not complete, and for rows completed before 2026-09-19.';

comment on column public.meal_plan_items.skipped_at is
  'Set when the person explicitly said they did not eat this. Distinct from completed_at being null, which only means nobody has answered yet.';

-- The nightly pass reads exactly this set, per user, every hour.
create index if not exists meal_plan_items_pending_idx
  on public.meal_plan_items (user_id)
  where completed_at is null and skipped_at is null;

grant select (completed_source, skipped_at), update (completed_source, skipped_at)
  on public.meal_plan_items to authenticated;
